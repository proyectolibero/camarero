/**
 * Escritura segura de documentos.
 *
 * Invariantes:
 *  1. Toda ruta se resuelve con safeResolve y se comprueba contra enlaces antes de
 *     escribir: nunca se escribe fuera de docs/memory, ni por un junction.
 *  2. Todo contenido pasa por la guarda de secretos antes de tocar disco.
 *  3. El frontmatter se valida contra el esquema ANTES de escribir. Antes no se
 *     validaba y el servidor podia persistir documentos invalidos que solo fallaban
 *     al releerlos, dejando basura en disco.
 *  4. La escritura es atomica (fichero temporal + rename).
 */
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { FrontmatterSchema, STATUS_BY_TYPE } from "../schema.ts"
import { parseMarkdown, serializeMarkdown, upsertSection } from "./frontmatter.ts"
import { assertNoSecrets, assertSizeWithinLimit } from "./guards.ts"
import { assertRealPathContained, memoryRoot, safeResolve, toRelative } from "./paths.ts"

export interface WriteResult {
  readonly path: string
  readonly created: boolean
}

export class DocumentNotFoundError extends Error {
  constructor(relativePath: string) {
    super(`No existe el documento "${relativePath}" en la memoria.`)
    this.name = "DocumentNotFoundError"
  }
}

export class InvalidFrontmatterError extends Error {
  readonly issues: readonly string[]
  constructor(relativePath: string, issues: readonly string[]) {
    super(
      `Frontmatter invalido para "${relativePath}": ${issues.join("; ")}. ` +
        "No se ha escrito nada.",
    )
    this.name = "InvalidFrontmatterError"
    this.issues = issues
  }
}

/**
 * Solo "no existe" significa "no existe". Antes cualquier error (permisos, disco
 * lleno, ruta demasiado larga) se interpretaba como ausencia y se traducia a un
 * "no existe el documento" que ocultaba el problema real.
 */
async function exists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT" || code === "ENOTDIR") return false
    throw error
  }
}

/** Comprueba el contrato del documento antes de escribir. Devuelve los problemas. */
function frontmatterIssues(data: Record<string, unknown>): string[] {
  const issues: string[] = []
  const parsed = FrontmatterSchema.safeParse(data)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join(".") || "frontmatter"}: ${issue.code}`)
    }
    return issues
  }
  const allowed = STATUS_BY_TYPE[parsed.data.type]
  if (!allowed.includes(parsed.data.status)) {
    issues.push(`status: no permitido para el tipo "${parsed.data.type}"`)
  }
  if (parsed.data.supersedes !== null && parsed.data.id === parsed.data.supersedes) {
    issues.push("supersedes: un documento no puede reemplazarse a si mismo")
  }
  return issues
}

async function atomicWrite(absolutePath: string, content: string, root: string): Promise<void> {
  await assertRealPathContained(absolutePath, root)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  // Se vuelve a comprobar despues de crear el directorio: si el mkdir acaba de
  // materializar un ancestro, es el momento de saber si es un enlace.
  await assertRealPathContained(absolutePath, root)

  const temporary = `${absolutePath}.tmp-${process.pid}-${Date.now()}`
  try {
    await writeFile(temporary, content, "utf8")
    await rename(temporary, absolutePath)
  } catch (error) {
    // Limpieza del temporal: si esto falla, el error original es el que importa.
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

/** Crea o reemplaza un documento completo. Solo para tipos que no son append-only. */
export async function writeDocument(
  relativePath: string,
  data: Record<string, unknown>,
  body: string,
  root: string = memoryRoot(),
): Promise<WriteResult> {
  const issues = frontmatterIssues(data)
  if (issues.length > 0) {
    throw new InvalidFrontmatterError(relativePath, issues)
  }

  const absolute = safeResolve(relativePath, root)
  const content = serializeMarkdown(data, body)
  assertSizeWithinLimit(content)
  assertNoSecrets(content)
  const created = !(await exists(absolute))
  await atomicWrite(absolute, content, root)
  return { path: toRelative(absolute, root), created }
}

/** Cambia campos del frontmatter conservando el cuerpo. */
export async function patchFrontmatter(
  relativePath: string,
  patch: Record<string, unknown>,
  root: string = memoryRoot(),
): Promise<WriteResult> {
  const absolute = safeResolve(relativePath, root)
  if (!(await exists(absolute))) {
    throw new DocumentNotFoundError(relativePath)
  }
  const source = await readFile(absolute, "utf8")
  const parsed = parseMarkdown(source)
  const merged = { ...parsed.data, ...patch }

  const issues = frontmatterIssues(merged)
  if (issues.length > 0) {
    throw new InvalidFrontmatterError(relativePath, issues)
  }

  const content = serializeMarkdown(merged, parsed.body)
  assertSizeWithinLimit(content)
  assertNoSecrets(content)
  await atomicWrite(absolute, content, root)
  return { path: toRelative(absolute, root), created: false }
}

/** Anade texto al final del cuerpo. Base del registro append-only. */
export async function appendToBody(
  relativePath: string,
  text: string,
  root: string = memoryRoot(),
): Promise<WriteResult> {
  const absolute = safeResolve(relativePath, root)
  if (!(await exists(absolute))) {
    throw new DocumentNotFoundError(relativePath)
  }
  const source = await readFile(absolute, "utf8")
  const parsed = parseMarkdown(source)
  const body = `${parsed.body.trimEnd()}\n\n${text.trim()}\n`
  const content = serializeMarkdown(parsed.data, body)
  assertSizeWithinLimit(content)
  assertNoSecrets(content)
  await atomicWrite(absolute, content, root)
  return { path: toRelative(absolute, root), created: false }
}

/** Reemplaza o crea una seccion `## Titulo` dentro del cuerpo. */
export async function upsertBodySection(
  relativePath: string,
  heading: string,
  content: string,
  root: string = memoryRoot(),
): Promise<WriteResult> {
  const absolute = safeResolve(relativePath, root)
  if (!(await exists(absolute))) {
    throw new DocumentNotFoundError(relativePath)
  }
  const source = await readFile(absolute, "utf8")
  const parsed = parseMarkdown(source)
  const body = upsertSection(parsed.body, heading, content)
  const serialized = serializeMarkdown(parsed.data, body)
  assertSizeWithinLimit(serialized)
  assertNoSecrets(serialized)
  await atomicWrite(absolute, serialized, root)
  return { path: toRelative(absolute, root), created: false }
}
