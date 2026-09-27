/**
 * Guardas de contenido.
 *
 * La memoria del proyecto vive en un repositorio publico con licencia AGPL.
 * Un secreto escrito aqui es un incidente permanente: queda en el historial de git
 * para siempre. Por eso esta guarda es BLOQUEANTE, no consultiva.
 *
 * Hay dos funciones distintas y conviene no confundirlas:
 *  - `assertNoSecrets`: decide si una escritura se permite. Lanza.
 *  - `redactForOutput`: limpia cualquier texto que vaya a salir del servidor
 *    (mensajes de error, incidencias de carga). Nunca se devuelve un valor crudo.
 */

export type FindingSeverity = "block" | "warn"

export interface Finding {
  readonly rule: string
  readonly severity: FindingSeverity
  readonly message: string
  /** Linea (1-indexada) donde se detecto. */
  readonly line: number
  /** Fragmento enmascarado: nunca el valor completo. */
  readonly masked: string
}

interface Rule {
  readonly name: string
  readonly severity: FindingSeverity
  readonly message: string
  readonly pattern: RegExp
}

/** Claves, tokens y cadenas de conexion. Bloqueantes. */
const SECRET_RULES: readonly Rule[] = [
  {
    name: "aws-access-key",
    severity: "block",
    message: "Clave de acceso de AWS detectada.",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "github-token",
    severity: "block",
    message: "Token de GitHub detectado.",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  },
  {
    name: "openai-key",
    severity: "block",
    message: "Clave de API tipo OpenAI/Anthropic detectada.",
    pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "slack-token",
    severity: "block",
    message: "Token de Slack detectado.",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: "jwt",
    severity: "block",
    message: "JWT detectado. Nunca se guardan tokens de sesion en la memoria.",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: "private-key",
    severity: "block",
    message: "Clave privada en PEM detectada.",
    pattern: /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/g,
  },
  {
    name: "connection-string",
    severity: "block",
    message: "Cadena de conexion con credenciales embebidas.",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s:@/]+@/g,
  },
  {
    // Se aceptan ':', '=', '->' y '=>' como separadores: la evidencia de auditoria
    // demostro que exigir solo ':' y '=' permitia escribir un secreto con '->'.
    name: "assigned-secret",
    severity: "block",
    message: "Asignacion de secreto (password, api key, token) con valor.",
    pattern:
      /\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret)\b\s*(?::|->|=>|=)\s*(?:"[^"]{6,}"|'[^']{6,}'|[^\s"'#|>][^\s"'#]{7,})/gi,
  },
  {
    name: "bearer-token",
    severity: "block",
    message: "Cabecera Authorization con token literal.",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g,
  },
  {
    name: "supabase-service-role",
    severity: "block",
    message: "Referencia a una clave service_role de Supabase.",
    pattern: /\bservice[_-]?role[_-]?key\b\s*[:=]\s*\S+/gi,
  },
]

/** Datos personales. Se avisa, no se bloquea: la memoria puede citar contactos del proyecto. */
const PII_RULES: readonly Rule[] = [
  {
    name: "email",
    severity: "warn",
    message: "Direccion de correo detectada. Un comensal nunca debe aparecer aqui.",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
]

/** Dominios cuya aparicion es legitima: contacto del propio proyecto. */
const EMAIL_ALLOWLIST = [/@proyectolibero\.org$/i, /@example\.(?:com|org)$/i, /noreply@/i]

export const MAX_CONTENT_BYTES = 256 * 1024

export function mask(value: string): string {
  const head = value.slice(0, 4)
  return `${head}${"*".repeat(Math.min(12, Math.max(4, value.length - 4)))}`
}

/**
 * Resuelve el numero de linea de cada coincidencia en una sola pasada.
 * La version anterior recorria el texto desde el principio por cada hallazgo,
 * lo que hacia el escaneo cuadratico: un documento ruidoso de 256 KB tardaba
 * 4,4 s y bloqueaba el servidor. Ahora es una busqueda binaria sobre los saltos.
 */
function makeLineResolver(text: string): (index: number) => number {
  const newlineOffsets: number[] = []
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) newlineOffsets.push(i)
  }
  return (index: number): number => {
    let low = 0
    let high = newlineOffsets.length
    while (low < high) {
      const mid = (low + high) >> 1
      if ((newlineOffsets[mid] ?? 0) <= index) low = mid + 1
      else high = mid
    }
    return low + 1
  }
}

function runRules(
  text: string,
  rules: readonly Rule[],
  shouldSkip?: (value: string) => boolean,
): Finding[] {
  const findings: Finding[] = []
  const lineOf = makeLineResolver(text)

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    for (const match of text.matchAll(pattern)) {
      if (shouldSkip?.(match[0]) === true) continue
      findings.push({
        rule: rule.name,
        severity: rule.severity,
        message: rule.message,
        line: lineOf(match.index ?? 0),
        masked: mask(match[0]),
      })
    }
  }
  return findings
}

/** Analiza un texto y devuelve todos los hallazgos, sin lanzar excepcion. */
export function scanContent(text: string): Finding[] {
  const secrets = runRules(text, SECRET_RULES)
  // La allowlist se evalua sobre el valor original: el valor enmascarado ya no
  // conserva el dominio, asi que comprobarla despues seria inutil.
  const pii = runRules(text, PII_RULES, (value) =>
    EMAIL_ALLOWLIST.some((allowed) => allowed.test(value)),
  )
  return [...secrets, ...pii]
}

/**
 * Sustituye por mascaras todo lo sensible de un texto destinado a salir del servidor.
 *
 * Es la ultima linea de defensa para mensajes de error. Un error de libreria puede
 * incluir la linea de origen del fichero que lo provoco; si esa linea tiene un
 * token, sin esta funcion el token acabaria en el contexto de un agente y en el
 * proveedor del modelo. La auditoria lo demostro con un frontmatter roto.
 */
export function redactForOutput(text: string): string {
  let result = text
  for (const rule of [...SECRET_RULES, ...PII_RULES]) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    result = result.replace(pattern, (match) => mask(match))
  }
  return result
}

export class SecretDetectedError extends Error {
  readonly findings: readonly Finding[]
  constructor(findings: readonly Finding[]) {
    const summary = findings
      .map((finding) => `  - linea ${finding.line}: ${finding.message} (${finding.masked})`)
      .join("\n")
    super(
      `Escritura rechazada: el contenido contiene ${findings.length} posible(s) secreto(s).\n` +
        `${summary}\n` +
        "Quita el valor real antes de guardar. Si es un ejemplo, usa un marcador como TOKEN_DE_EJEMPLO.",
    )
    this.name = "SecretDetectedError"
    this.findings = findings
  }
}

export function assertNoSecrets(text: string): void {
  const blocking = scanContent(text).filter((finding) => finding.severity === "block")
  if (blocking.length > 0) {
    throw new SecretDetectedError(blocking)
  }
}

export class ContentTooLargeError extends Error {
  constructor(bytes: number) {
    super(
      `Documento demasiado grande: ${bytes} bytes. El maximo es ${MAX_CONTENT_BYTES}. ` +
        "Divide el documento o mueve el detalle a un contrato aparte.",
    )
    this.name = "ContentTooLargeError"
  }
}

export function assertSizeWithinLimit(text: string): void {
  const bytes = Buffer.byteLength(text, "utf8")
  if (bytes > MAX_CONTENT_BYTES) {
    throw new ContentTooLargeError(bytes)
  }
}
