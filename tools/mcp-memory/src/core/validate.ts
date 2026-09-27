/**
 * Integridad de la memoria y gate de rigor.
 *
 * Dos niveles:
 *  - `validateMemory`: informe completo, no lanza. Detecta referencias rotas,
 *    identificadores duplicados, secretos, decisiones sin alternativas, etc.
 *  - `assertTaskGate`: bloqueante, y **fail-closed**. Es lo que impide declarar una
 *    tarea terminada sin tests en verde y sin documentacion.
 *
 * La auditoria de seguridad encontro dos fallos de diseno aqui, ya corregidos:
 *  1. `assertTaskGate` consultaba el campo `requires` del propio documento, asi que
 *     quien creaba la tarea podia desactivar el control. Ahora los requisitos son
 *     fijos (`TASK_REQUIREMENTS`) y un `requires` que intente desactivarlos es un error.
 *  2. Si `requires` no parseaba, el gate se saltaba en silencio (fail-open). Ya no
 *     existe esa rama: no hay ningun camino en el que el gate no compruebe todo.
 */
import {
  type DocType,
  type MemoryDoc,
  SINGLETON_TYPES,
  TASK_REQUIREMENTS,
  TaskTestsSchema,
} from "../schema.ts"
import { scanContent } from "./guards.ts"
import { docPath } from "./paths.ts"
import { type MemoryStore, safeJson } from "./store.ts"

export type IssueSeverity = "error" | "warning"

export interface ValidateIssue {
  readonly severity: IssueSeverity
  readonly code: string
  readonly message: string
  readonly docId?: string
  readonly path?: string
}

/** Campos del frontmatter que contienen identificadores de otros documentos. */
const REFERENCE_FIELDS = ["related", "supersedes", "superseded_by", "depends_on", "blocks"] as const

/** Seccion que toda decision aceptada debe declarar. */
const REQUIRED_DECISION_SECTION = "alternativas"

function issue(
  severity: IssueSeverity,
  code: string,
  message: string,
  doc?: MemoryDoc,
): ValidateIssue {
  return {
    severity,
    code,
    message,
    ...(doc !== undefined ? { docId: doc.id, path: doc.path } : {}),
  }
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

/**
 * Referencias declaradas por un documento.
 *
 * `doc` queda fuera a proposito: es una RUTA a un fichero, no un identificador. La
 * version anterior lo trataba como id y habria producido un "referencia-rota" falso
 * en cuanto una tarea apuntase a su documento de diseno.
 */
function referencesOf(doc: MemoryDoc): string[] {
  const refs: string[] = [...doc.related]
  if (doc.supersedes !== null) refs.push(doc.supersedes)
  if (doc.superseded_by !== null) refs.push(doc.superseded_by)

  for (const field of REFERENCE_FIELDS) {
    refs.push(...collectStrings(doc.extra[field]))
  }
  return refs.filter((ref) => ref.trim() !== "")
}

function hasSection(doc: MemoryDoc, heading: string): boolean {
  const pattern = new RegExp(`^##\\s+${heading}\\b`, "im")
  return pattern.test(doc.body)
}

function checkDuplicates(docs: readonly MemoryDoc[]): ValidateIssue[] {
  const issues: ValidateIssue[] = []
  const seen = new Map<string, MemoryDoc>()

  for (const doc of docs) {
    const previous = seen.get(doc.id.toLowerCase())
    if (previous !== undefined) {
      issues.push(
        issue(
          "error",
          "id-duplicado",
          `El identificador "${doc.id}" ya existe en ${previous.path}.`,
          doc,
        ),
      )
      continue
    }
    seen.set(doc.id.toLowerCase(), doc)
  }
  return issues
}

function checkSingletons(store: MemoryStore): ValidateIssue[] {
  return SINGLETON_TYPES.flatMap((type) => {
    const found = store.byType(type)
    if (found.length <= 1) return []
    return [
      issue(
        "error",
        "singleton-duplicado",
        `El tipo "${type}" es unico pero hay ${found.length} documentos: ` +
          `${found.map((doc) => doc.path).join(", ")}.`,
      ),
    ]
  })
}

function checkReferences(store: MemoryStore, doc: MemoryDoc): ValidateIssue[] {
  return referencesOf(doc)
    .filter((reference) => store.findById(reference) === undefined)
    .map((reference) =>
      issue("error", "referencia-rota", `Referencia a "${reference}", que no existe.`, doc),
    )
}

function checkContent(doc: MemoryDoc): ValidateIssue[] {
  // Se escanea el documento COMPLETO. Antes solo se miraban `extra` y el cuerpo, asi
  // que un secreto en `title` u `owner` era invisible para el validador.
  const haystack = [
    safeJson({
      title: doc.title,
      owner: doc.owner ?? null,
      tags: doc.tags,
      related: doc.related,
      extra: doc.extra,
    }),
    doc.body,
  ].join("\n")

  return scanContent(haystack).map((finding) =>
    issue(
      finding.severity === "block" ? "error" : "warning",
      finding.severity === "block" ? "secreto-detectado" : "posible-dato-personal",
      `${finding.message} (linea ${finding.line}, ${finding.masked})`,
      doc,
    ),
  )
}

function checkDecisionAlternatives(doc: MemoryDoc): ValidateIssue[] {
  const isDecision = doc.type === "adr" || doc.type === "decision"
  if (!isDecision || doc.status !== "accepted") return []
  if (hasSection(doc, REQUIRED_DECISION_SECTION)) return []
  return [
    issue(
      "error",
      "decision-sin-alternativas",
      `Una ${doc.type} aceptada debe declarar la seccion "## Alternativas". ` +
        "Sin alternativas descartadas no hay decision, solo una preferencia.",
      doc,
    ),
  ]
}

/**
 * El identificador y el nombre del fichero deben corresponderse.
 * Se comprueba de forma laxa (el fichero empieza por el id) porque el slug del titulo
 * puede cambiar sin que la identidad cambie. Es un aviso, no un error: la memoria
 * real ya tiene nombres elegidos a mano.
 */
function checkIdPathConsistency(doc: MemoryDoc): ValidateIssue[] {
  // Se compara solo el NOMBRE del fichero, no la ruta completa: `decisions/d-001-x.md`
  // es correcto, y comparar la ruta entera producia un aviso falso en cada documento
  // que vive en una subcarpeta (es decir, en casi todos).
  const base = (doc.path.split("/").pop() ?? doc.path).toLowerCase()
  const expectedPrefix = `${doc.id.toLowerCase()}-`
  const expectedSingleton = `${doc.id.toLowerCase()}.md`

  if (base === expectedSingleton || base.startsWith(expectedPrefix)) return []
  return [
    issue(
      "warning",
      "id-no-coincide-con-ruta",
      `El fichero "${doc.path}" no empieza por "${doc.id.toLowerCase()}". ` +
        `La ruta canonica seria "${docPath(doc.type, doc.id, doc.title)}".`,
      doc,
    ),
  ]
}

function checkNumbering(store: MemoryStore, type: DocType): ValidateIssue[] {
  const numbers = store
    .byType(type)
    .map((doc) => Number.parseInt(doc.id.replace(/\D+/g, ""), 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  const issues: ValidateIssue[] = []
  for (let i = 1; i < numbers.length; i += 1) {
    const current = numbers[i]
    const previous = numbers[i - 1]
    if (current === undefined || previous === undefined || current === previous + 1) continue
    issues.push(
      issue(
        "warning",
        "hueco-en-numeracion",
        `Falta el numero ${previous + 1} de "${type}" (se pasa de ${previous} a ${current}). ` +
          "No se reutiliza, pero conviene saber por que.",
      ),
    )
  }
  return issues
}

function checkOrphanAdrs(store: MemoryStore): ValidateIssue[] {
  return store
    .byType("adr")
    .filter((adr) => adr.status === "accepted")
    .filter(
      (adr) => !store.all().some((doc) => doc.id !== adr.id && referencesOf(doc).includes(adr.id)),
    )
    .map((adr) =>
      issue(
        "warning",
        "adr-huerfano",
        "Ningun documento enlaza con este ADR. Enlazalo desde una decision o una tarea.",
        adr,
      ),
    )
}

/**
 * Forma antigua e inofensiva de `requires`, la unica que no se reporta.
 *
 * El campo ya no existe en `task_create`. Cualquier aparicion que no sea exactamente
 * `{tests:true, doc:true}` es un intento de relajar el control, incluido un valor que
 * ni siquiera sea un objeto.
 */
function isHarmlessRequires(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record["tests"] === true && record["doc"] === true
}

function taskIssues(doc: MemoryDoc): ValidateIssue[] {
  const issues: ValidateIssue[] = []

  const acceptance = doc.extra["acceptance"]
  const hasAcceptanceList = Array.isArray(acceptance) && acceptance.length > 0
  if (!hasAcceptanceList && !hasSection(doc, "aceptacion")) {
    issues.push(
      issue(
        "error",
        "tarea-sin-aceptacion",
        "La tarea no declara criterios de aceptacion: ni el campo `acceptance` ni una " +
          'seccion "## Aceptacion" con al menos un criterio.',
        doc,
      ),
    )
  }

  // Un `requires` que no sea la forma antigua inofensiva es un intento de apagar el
  // control, y da igual que sea un booleano suelto, un texto o un objeto a medias.
  const requires = doc.extra["requires"]
  if (requires !== undefined && !isHarmlessRequires(requires)) {
    issues.push(
      issue(
        "error",
        "gate-no-configurable",
        "El campo `requires` no puede desactivar el gate: los requisitos son fijos. " +
          "Si una tarea no admite test automatizado, dilo en la evidencia.",
        doc,
      ),
    )
  }

  return issues
}

function gateIssues(task: MemoryDoc, store: MemoryStore): ValidateIssue[] {
  const issues: ValidateIssue[] = []

  const tests = TaskTestsSchema.safeParse(task.extra["tests"] ?? {})
  if (!tests.success || tests.data.passed !== true) {
    issues.push(
      issue(
        "error",
        "gate-tests",
        'Tarea marcada como "done" pero los tests no constan en verde. ' +
          'Registra "tests.passed: true" con su evidencia.',
        task,
      ),
    )
  } else if (tests.data.evidence === null || tests.data.evidence.trim() === "") {
    issues.push(
      issue(
        "error",
        "gate-evidencia",
        'Tarea "done" sin evidencia. Anota el comando y el resultado: sin eso no hay ' +
          "verificacion, solo una afirmacion.",
        task,
      ),
    )
  }

  if (TASK_REQUIREMENTS.doc) {
    const docRef = task.extra["doc"]
    if (typeof docRef !== "string" || !store.has(docRef)) {
      issues.push(
        issue(
          "error",
          "gate-documentacion",
          'Tarea "done" sin documento asociado existente. El campo "doc" debe apuntar ' +
            "a un fichero real de la memoria.",
          task,
        ),
      )
    }
  }

  const dependencies = task.extra["depends_on"]
  if (Array.isArray(dependencies)) {
    for (const dependency of dependencies) {
      if (typeof dependency !== "string") continue
      const found = store.findById(dependency)
      if (found === undefined) {
        issues.push(
          issue("error", "gate-dependencia", `Depende de "${dependency}", que no existe.`, task),
        )
      } else if (found.status !== "done") {
        issues.push(
          issue(
            "error",
            "gate-dependencia",
            `No puede cerrarse: la dependencia "${dependency}" esta en "${found.status}".`,
            task,
          ),
        )
      }
    }
  }

  return issues
}

export function isTaskDone(task: MemoryDoc): boolean {
  return task.status === "done"
}

export function validateMemory(store: MemoryStore): ValidateIssue[] {
  const docs = store.all()
  const issues: ValidateIssue[] = []

  for (const loadIssue of store.getIssues()) {
    issues.push({
      severity: "error",
      code: "documento-invalido",
      message: loadIssue.message,
      path: loadIssue.path,
    })
  }

  issues.push(...checkDuplicates(docs))
  issues.push(...checkSingletons(store))

  for (const doc of docs) {
    issues.push(...checkReferences(store, doc))
    issues.push(...checkContent(doc))
    issues.push(...checkDecisionAlternatives(doc))
    issues.push(...checkIdPathConsistency(doc))
    if (doc.type === "task") {
      issues.push(...taskIssues(doc))
      if (isTaskDone(doc)) issues.push(...gateIssues(doc, store))
    }
  }

  issues.push(...checkOrphanAdrs(store))
  for (const type of ["adr", "decision", "risk", "question", "lesson"] as const) {
    issues.push(...checkNumbering(store, type))
  }

  return issues
}

export class GateError extends Error {
  readonly issues: readonly ValidateIssue[]
  constructor(taskId: string, issues: readonly ValidateIssue[]) {
    const summary = issues.map((item) => `  - [${item.code}] ${item.message}`).join("\n")
    super(
      `Gate de rigor: la tarea ${taskId} no puede cerrarse.\n${summary}\n` +
        "Corrige los puntos anteriores o deja la tarea en estado distinto de 'done'.",
    )
    this.name = "GateError"
    this.issues = issues
  }
}

/**
 * Comprueba que una tarea puede pasar a `done`. Lanza `GateError` si no.
 * No modifica nada: solo decide. El llamante debe invocarlo siempre que el estado
 * RESULTANTE sea `done`, no solo cuando la peticion lo pida explicitamente: la
 * auditoria demostro que una actualizacion sin `status` dejaba una tarea cerrada
 * con los tests en rojo.
 */
export function assertTaskGate(task: MemoryDoc, store: MemoryStore): void {
  const issues = gateIssues({ ...task, status: "done" }, store).filter(
    (item) => item.severity === "error",
  )
  if (issues.length > 0) {
    throw new GateError(task.id, issues)
  }
}

/** Errores de integridad, sin los avisos. Util para comprobar tras una escritura. */
export function integrityErrors(store: MemoryStore): ValidateIssue[] {
  return validateMemory(store).filter((item) => item.severity === "error")
}
