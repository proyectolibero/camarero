/**
 * Resolucion de rutas segura.
 *
 * Todo acceso a disco pasa por aqui. La regla es simple:
 * el MCP solo puede leer y escribir dentro de `docs/memory/`.
 * Cualquier ruta que escape de esa raiz es un error, no una advertencia.
 *
 * Hay dos niveles de defensa y los dos son necesarios:
 *  1. `safeResolve` — comprobacion lexica, sincrona, en cada llamada.
 *  2. `assertRealPathContained` — comprobacion fisica, asincrona, antes de escribir.
 *     Es la que detecta enlaces y junctions que desvian la escritura fuera.
 */
import { existsSync } from "node:fs"
import { lstat, realpath } from "node:fs/promises"
import path from "node:path"
import { DIR_BY_TYPE, type DocType, SINGLETON_TYPES } from "../schema.ts"

/** Raiz del repositorio del proyecto. */
export function repoRoot(): string {
  const fromEnv = process.env["CAMARERO_REPO_ROOT"]
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
    return path.resolve(fromEnv)
  }
  // Este fichero vive en <repo>/tools/mcp-memory/src/core/paths.ts
  return path.resolve(import.meta.dirname, "..", "..", "..", "..")
}

export function memoryRoot(): string {
  const fromEnv = process.env["CAMARERO_MEMORY_ROOT"]
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
    return path.resolve(fromEnv)
  }
  return path.join(repoRoot(), "docs", "memory")
}

/** Normaliza para comparar rutas en Windows, que no distingue mayusculas. */
function comparable(absolutePath: string): string {
  return path
    .resolve(absolutePath)
    .replace(/[\\/]+$/, "")
    .toLowerCase()
}

export class PathEscapeError extends Error {
  constructor(relativePath: string, reason = "queda fuera de docs/memory") {
    super(
      `Ruta rechazada: "${relativePath}" ${reason}. ` +
        "El MCP solo puede leer y escribir dentro de la memoria del proyecto.",
    )
    this.name = "PathEscapeError"
  }
}

/**
 * Segmentos que no admiten ninguna interpretacion legitima en la memoria:
 *  - `:` activa flujos de datos alternativos de NTFS (`fichero.md:secreto`).
 *  - Punto o espacio final: Windows los recorta y el nombre real no es el esperado.
 *  - `.` y `..`: apuntan a directorios, no a documentos.
 */
function assertSafeSegments(cleaned: string, original: string): void {
  for (const segment of cleaned.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new PathEscapeError(original, "contiene un segmento no valido")
    }
    if (segment.includes(":")) {
      throw new PathEscapeError(original, "contiene ':', reservado por el sistema de ficheros")
    }
    if (/[. ]$/.test(segment)) {
      throw new PathEscapeError(original, "tiene un punto o espacio final")
    }
    if (segment.startsWith("~")) {
      throw new PathEscapeError(original, "usa una ruta de usuario")
    }
  }
}

/**
 * Convierte una ruta relativa a `docs/memory/` en una ruta absoluta segura.
 * Rechaza rutas absolutas, `..`, unidades de disco, flujos NTFS y escapes de la raiz.
 */
export function safeResolve(relativePath: string, root = memoryRoot()): string {
  // Un espacio (o un tabulador) al principio o al final no forma parte de un nombre
  // valido: Windows puede recortarlo y el nombre real dejaria de ser el que cree el
  // llamante. Se rechaza en lugar de normalizarlo en silencio.
  if (relativePath !== relativePath.trim()) {
    throw new PathEscapeError(relativePath, "tiene espacios al principio o al final")
  }
  const cleaned = relativePath.replace(/\\/g, "/")
  if (cleaned === "" || cleaned.startsWith("/")) {
    throw new PathEscapeError(relativePath, "es una ruta absoluta o vacia")
  }
  if (path.isAbsolute(cleaned) || /^[a-zA-Z]:/.test(cleaned)) {
    throw new PathEscapeError(relativePath, "es una ruta absoluta")
  }

  assertSafeSegments(cleaned, relativePath)

  const resolved = path.resolve(root, cleaned)
  const rootCmp = comparable(root)
  const resolvedCmp = comparable(resolved)
  if (resolvedCmp !== rootCmp && !resolvedCmp.startsWith(`${rootCmp}${path.sep}`)) {
    throw new PathEscapeError(relativePath)
  }
  return resolved
}

/**
 * Comprueba que la ruta real del ancestro existente mas profundo sigue dentro de la
 * raiz real de la memoria. Es lo que impide que un enlace simbolico o una junction
 * colocada dentro de `docs/memory/` redirija una escritura al resto del repositorio.
 *
 * Limitacion honesta: entre esta comprobacion y la escritura hay una ventana (TOCTOU).
 * Cerrarla del todo exige abrir el fichero por descriptor; no merece la pena para un
 * MCP local de un solo usuario. Se documenta en lugar de fingir que no existe.
 */
export async function assertRealPathContained(
  absolutePath: string,
  root: string = memoryRoot(),
): Promise<void> {
  const realRoot = comparable(await realpath(root))

  let current = path.dirname(absolutePath)
  for (;;) {
    const parent = path.dirname(current)
    if (parent === current) return

    const existing = await lstat(current).catch(() => null)
    if (existing !== null) {
      // No se rechaza por ser un enlace, sino por APUNTAR FUERA. Un enlace no es
      // peligroso en si: la memoria puede vivir en un disco enlazado y eso es legitimo.
      const real = comparable(await realpath(current))
      if (real !== realRoot && !real.startsWith(`${realRoot}${path.sep}`)) {
        throw new PathEscapeError(
          path.relative(root, absolutePath),
          "atraviesa un enlace que apunta fuera de la memoria",
        )
      }
      return
    }
    current = parent
  }
}

/** Ruta relativa normalizada, siempre con `/`, desde `docs/memory/`. */
export function toRelative(absolutePath: string, root = memoryRoot()): string {
  return path.relative(root, absolutePath).replace(/\\/g, "/")
}

export function isMarkdown(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith(".md")
}

/**
 * Normaliza un texto libre a slug apto para nombre de fichero.
 * Solo minusculas, digitos y guiones: nada de acentos ni espacios.
 */
export function slugify(input: string, maxLength = 64): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "")
  return base === "" ? "sin-titulo" : base
}

/**
 * Ruta relativa canonica de un documento.
 *
 * Los documentos unicos viven en `<tipo>.md` (overview.md, state.md...) porque su
 * identidad no depende del titulo: si el titulo cambia, el fichero NO debe moverse.
 * El resto lleva `<id>-<slug-del-titulo>.md`.
 */
export function docPath(type: DocType, id: string, title: string): string {
  if (SINGLETON_TYPES.includes(type)) {
    return `${type}.md`
  }
  const dir = DIR_BY_TYPE[type]
  const file = `${id.toLowerCase()}-${slugify(title)}.md`
  return dir === "." ? file : `${dir}/${file}`
}

export function ensureMemoryRootExists(root = memoryRoot()): void {
  if (!existsSync(root)) {
    throw new Error(
      `No existe la memoria del proyecto. Revisa la configuracion del MCP o define CAMARERO_MEMORY_ROOT.`,
    )
  }
}
