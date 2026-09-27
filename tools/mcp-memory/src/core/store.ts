/**
 * Carga, indexa y consulta los documentos de la memoria.
 *
 * No hay base de datos ni indice persistente: la fuente de verdad son los ficheros
 * markdown y el indice se reconstruye en memoria. Eso mantiene una sola frontera de
 * escritura (docs/memory) y garantiza que la memoria nunca queda irrecuperable.
 *
 * Todos los mensajes de incidencia pasan por `redactForOutput` y ninguno interpola
 * valores crudos del fichero: la auditoria de seguridad demostro que un frontmatter
 * roto con un token dentro filtraba el token a traves del mensaje de error.
 */
import type { Dirent } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import {
  DIR_BY_TYPE,
  type DocType,
  FrontmatterSchema,
  ID_PAD_BY_TYPE,
  ID_PREFIX_BY_TYPE,
  type MemoryDoc,
  SINGLETON_TYPES,
  STATUS_BY_TYPE,
} from "../schema.ts"
import { parseMarkdown } from "./frontmatter.ts"
import { MAX_CONTENT_BYTES, mask, redactForOutput } from "./guards.ts"
import { isMarkdown, memoryRoot, toRelative } from "./paths.ts"

export interface LoadIssue {
  readonly path: string
  readonly message: string
}

export interface SearchOptions {
  readonly type?: DocType
  readonly status?: string
  readonly phase?: string
  readonly tag?: string
  readonly limit?: number
}

export interface SearchHit {
  readonly doc: MemoryDoc
  readonly score: number
}

const EXTRA_KNOWN_KEYS = new Set([
  "id",
  "type",
  "title",
  "status",
  "date",
  "tags",
  "phase",
  "related",
  "supersedes",
  "superseded_by",
  "owner",
])

/** Normaliza para busquedas: minusculas y sin acentos. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * Serializa sin reventar con estructuras circulares.
 *
 * Un alias YAML recursivo (`foo: &x` / `bar: *x`) produce un objeto circular. La
 * auditoria lo probo: `JSON.stringify` lanzaba y tumbaba `memory_validate`,
 * `memory_search` y `memory_context`. Aqui se degrada a un marcador.
 */
export function safeJson(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return (
      JSON.stringify(value, (_key, item: unknown) => {
        if (typeof item === "object" && item !== null) {
          if (seen.has(item)) return "[circular]"
          seen.add(item)
        }
        return item
      }) ?? ""
    )
  } catch {
    return "[no serializable]"
  }
}

function tokenize(query: string): string[] {
  return normalizeText(query)
    .split(/[^a-z0-9ñ]+/u)
    .filter((token) => token.length >= 3)
}

export class MemoryStore {
  // Campo explicito, no propiedad de parametro: la sintaxis de propiedades de
  // parametro no es "erasable" y Node la rechaza al ejecutar TypeScript directamente.
  private readonly root: string
  private docs: MemoryDoc[] = []
  private issues: LoadIssue[] = []
  /** Texto normalizado por documento, calculado una sola vez en `load`. */
  private blobs = new Map<string, string>()
  private loaded = false

  constructor(root: string = memoryRoot()) {
    this.root = root
  }

  getRoot(): string {
    return this.root
  }

  async load(force = false): Promise<void> {
    if (this.loaded && !force) return

    const docs: MemoryDoc[] = []
    const issues: LoadIssue[] = []
    const blobs = new Map<string, string>()
    const files = await this.listMarkdownFiles()

    for (const absolute of files) {
      const relative = toRelative(absolute, this.root)
      try {
        const info = await stat(absolute)
        if (info.size > MAX_CONTENT_BYTES) {
          throw new Error(
            `documento de ${info.size} bytes, por encima del maximo de ${MAX_CONTENT_BYTES}`,
          )
        }
        const source = await readFile(absolute, "utf8")
        const doc = this.parseDoc(source, relative)
        docs.push(doc)
        blobs.set(doc.path, normalizeText(`${doc.title}\n${doc.tags.join(" ")}\n${doc.body}`))
      } catch (error) {
        issues.push({
          path: relative,
          // Nunca se propaga el mensaje crudo de la libreria: puede contener la linea
          // del fichero, y esa linea puede contener un secreto.
          message: redactForOutput(error instanceof Error ? error.message : String(error)),
        })
      }
    }

    this.docs = docs.sort((a, b) => a.id.localeCompare(b.id))
    this.issues = issues
    this.blobs = blobs
    this.loaded = true
  }

  private async listMarkdownFiles(): Promise<string[]> {
    // Anotacion de tipo explicita: Biome exige tipar una variable declarada sin inicializar.
    let entries: Dirent<string>[]
    try {
      entries = await readdir(this.root, { recursive: true, withFileTypes: true })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`No se pudo leer la memoria: ${redactForOutput(detail)}`)
    }

    return entries
      .filter((entry) => entry.isFile() && isMarkdown(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((absolute) => !absolute.split(path.sep).includes("node_modules"))
      .sort()
  }

  private parseDoc(source: string, relative: string): MemoryDoc {
    const { data, body } = parseMarkdown(source)
    const parsed = FrontmatterSchema.safeParse(data)
    if (!parsed.success) {
      // Se usa la ruta del campo y el codigo del error, NUNCA el mensaje de zod:
      // incluye el valor recibido entre comillas, y ese valor puede ser un secreto.
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "frontmatter"} (${issue.code})`)
        .join("; ")
      throw new Error(`frontmatter invalido: ${detail}`)
    }

    const fm = parsed.data
    const allowed = STATUS_BY_TYPE[fm.type]
    if (!allowed.includes(fm.status)) {
      throw new Error(
        `estado no permitido para el tipo "${fm.type}" ` +
          `(recibido: ${mask(fm.status)}; permitidos: ${allowed.join(", ")})`,
      )
    }

    const extra: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (!EXTRA_KNOWN_KEYS.has(key)) extra[key] = value
    }

    // Un alias YAML recursivo produce un objeto circular que luego revienta cualquier
    // serializacion. Es mejor rechazar el documento al cargarlo que arrastrar el fallo.
    try {
      JSON.stringify(extra)
    } catch {
      throw new Error("el frontmatter contiene referencias circulares (alias YAML recursivo)")
    }

    const doc: MemoryDoc = {
      id: fm.id,
      type: fm.type,
      title: fm.title,
      status: fm.status,
      date: fm.date,
      tags: fm.tags,
      related: fm.related,
      supersedes: fm.supersedes,
      superseded_by: fm.superseded_by,
      extra,
      body,
      path: relative,
      ...(fm.phase !== undefined ? { phase: fm.phase } : {}),
      ...(fm.owner !== undefined ? { owner: fm.owner } : {}),
    }
    return doc
  }

  all(): readonly MemoryDoc[] {
    return this.docs
  }

  getIssues(): readonly LoadIssue[] {
    return this.issues
  }

  byType(type: DocType): readonly MemoryDoc[] {
    return this.docs.filter((doc) => doc.type === type)
  }

  findById(id: string): MemoryDoc | undefined {
    const needle = id.trim().toLowerCase()
    return this.docs.find((doc) => doc.id.toLowerCase() === needle)
  }

  findByPath(relativePath: string): MemoryDoc | undefined {
    const needle = relativePath.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase()
    return this.docs.find((doc) => doc.path.toLowerCase() === needle)
  }

  /**
   * Documento unico de un tipo.
   *
   * Si hubiera mas de uno (un fichero mal nombrado, por ejemplo), se prefiere el de
   * la ruta canonica `<tipo>.md`. Sin esta preferencia el documento que leen los
   * agentes dependia del orden alfabetico de los ficheros, y un duplicado podia
   * sombrear al original.
   */
  singleton(type: DocType): MemoryDoc | undefined {
    const found = this.docs.filter((doc) => doc.type === type)
    if (found.length === 0) return undefined
    const canonical = found.find((doc) => doc.path.toLowerCase() === `${type}.md`)
    return canonical ?? found[0]
  }

  has(relativePath: string): boolean {
    const needle = relativePath.replace(/\\/g, "/").toLowerCase()
    return this.docs.some((doc) => doc.path.toLowerCase() === needle)
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const terms = tokenize(query)
    const limit = options.limit ?? 10

    const hits: SearchHit[] = []
    for (const doc of this.docs) {
      if (options.type !== undefined && doc.type !== options.type) continue
      if (options.status !== undefined && doc.status !== options.status) continue
      if (options.phase !== undefined && doc.phase !== options.phase) continue
      if (options.tag !== undefined && !doc.tags.includes(options.tag)) continue

      const score = terms.length === 0 ? 0 : this.scoreDoc(doc, terms)
      if (terms.length > 0 && score <= 0) continue
      hits.push({ doc, score })
    }

    return hits
      .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
      .slice(0, limit)
  }

  private scoreDoc(doc: MemoryDoc, terms: readonly string[]): number {
    // El texto ya viene normalizado de `load`: antes se normalizaba en cada consulta,
    // y `memory_context` hace varias por llamada.
    const blob = this.blobs.get(doc.path) ?? ""
    const meta = normalizeText(`${doc.id} ${doc.title} ${doc.tags.join(" ")}`)

    let score = 0
    for (const term of terms) {
      if (doc.id.toLowerCase().includes(term)) score += 5
      if (meta.includes(term)) score += 3
      if (blob.includes(term)) score += 1
    }
    return score
  }

  /** Siguiente identificador libre para un tipo. Para tareas exige la fase. */
  nextId(type: DocType, phase?: string): string {
    const prefix = ID_PREFIX_BY_TYPE[type]
    if (prefix === undefined) {
      throw new Error(`El tipo "${type}" no admite numeracion automatica.`)
    }

    // Se continua desde el mayor existente y NO se rellena el hueco: un identificador
    // nunca se reutiliza, porque ya puede estar citado en otro documento o en un commit.
    if (type === "task") {
      if (phase === undefined || phase.trim() === "") {
        throw new Error("Para crear una tarea hace falta la fase, por ejemplo F1.")
      }
      const taskPrefix = `${prefix}${phase.toUpperCase()}-`
      const used = this.docs
        .map((doc) => doc.id)
        .filter((id) => id.startsWith(taskPrefix))
        .map((id) => Number.parseInt(id.slice(taskPrefix.length), 10))
        .filter((value) => Number.isFinite(value))
      const next = used.length === 0 ? 1 : Math.max(...used) + 1
      return `${taskPrefix}${String(next).padStart(2, "0")}`
    }

    const pad = ID_PAD_BY_TYPE[type] ?? 3
    const used = this.docs
      .map((doc) => doc.id)
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number.parseInt(id.slice(prefix.length), 10))
      .filter((value) => Number.isFinite(value))
    const next = used.length === 0 ? 1 : Math.max(...used) + 1
    return `${prefix}${String(next).padStart(pad, "0")}`
  }

  /** Subcarpeta donde vive un tipo. */
  dirOf(type: DocType): string {
    return DIR_BY_TYPE[type]
  }

  /** True si el tipo es un documento unico. */
  isSingleton(type: DocType): boolean {
    return SINGLETON_TYPES.includes(type)
  }
}
