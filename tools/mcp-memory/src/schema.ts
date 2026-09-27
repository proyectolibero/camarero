/**
 * Contrato de la memoria del Proyecto Camarero.
 *
 * Un documento de memoria es un fichero markdown con frontmatter YAML obligatorio.
 * El frontmatter es el contrato que el MCP valida en cada lectura y en cada escritura.
 *
 * Regla de oro: si un documento no valida contra este esquema, no existe.
 */
import { z } from "zod"

export const DOC_TYPES = [
  "adr",
  "decision",
  "task",
  "risk",
  "question",
  "lesson",
  "contract",
  "overview",
  "glossary",
  "conventions",
  "state",
  "roadmap",
  "log",
] as const

export const DocTypeSchema = z.enum(DOC_TYPES)
export type DocType = (typeof DOC_TYPES)[number]

/** Estados posibles de una tarea. Se declara antes para poder referenciarlo abajo. */
export const TASK_STATUSES = ["todo", "doing", "blocked", "review", "done", "cancelled"] as const

/** Estados permitidos por tipo de documento. Un estado fuera de su tipo es un error. */
export const STATUS_BY_TYPE: Record<DocType, readonly string[]> = {
  adr: ["proposed", "accepted", "superseded", "deprecated"],
  decision: ["proposed", "accepted", "superseded", "rejected"],
  task: TASK_STATUSES,
  risk: ["open", "mitigating", "closed", "accepted"],
  question: ["open", "answered", "dropped"],
  lesson: ["recorded"],
  contract: ["draft", "active", "deprecated"],
  overview: ["active"],
  glossary: ["active"],
  conventions: ["active"],
  state: ["active"],
  roadmap: ["active"],
  log: ["append-only"],
}

/** Documentos unicos: no puede existir mas de uno de cada tipo. */
export const SINGLETON_TYPES: readonly DocType[] = [
  "overview",
  "glossary",
  "conventions",
  "state",
  "roadmap",
  "log",
]

/** Tipos que solo admiten adicion. Nunca se sobrescriben ni se reescriben. */
export const APPEND_ONLY_TYPES: readonly DocType[] = ["adr", "decision", "lesson", "log"]

/** Subcarpeta de `docs/memory/` para cada tipo. `.` significa la raiz. */
export const DIR_BY_TYPE: Record<DocType, string> = {
  adr: "adr",
  decision: "decisions",
  task: "tasks",
  risk: "risks",
  question: "questions",
  lesson: "lessons",
  contract: "contracts",
  log: "log",
  overview: ".",
  glossary: ".",
  conventions: ".",
  state: ".",
  roadmap: ".",
}

/** Prefijo del identificador. Los tipos sin prefijo usan el nombre del tipo como `id`. */
export const ID_PREFIX_BY_TYPE: Partial<Record<DocType, string>> = {
  adr: "ADR-",
  decision: "D-",
  task: "TASK-",
  risk: "RISK-",
  question: "OQ-",
  lesson: "LL-",
}

/** Digitos de relleno del identificador. El de tarea es variable por incluir la fase. */
export const ID_PAD_BY_TYPE: Partial<Record<DocType, number>> = {
  adr: 4,
  decision: 3,
  risk: 3,
  question: 3,
  lesson: 3,
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const ID_RE =
  /^(ADR-\d{4}|D-\d{3}|TASK-[A-Z0-9]{1,4}-\d{2}|RISK-\d{3}|OQ-\d{3}|LL-\d{3}|CONTRACT-[a-z0-9]+(?:-[a-z0-9]+)*|overview|glossary|conventions|state|roadmap|log)$/
export const PHASE_RE = /^F[0-9]{1,2}(?:\.[0-9]{1,2})?$/
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Tipos que admiten creacion y reemplazo. El resto solo crece. */
export const MUTABLE_TYPES = [
  "overview",
  "glossary",
  "conventions",
  "state",
  "roadmap",
  "contract",
] as const

/**
 * Frontmatter comun. `passthrough()` conserva campos especificos de cada tipo
 * (por ejemplo `acceptance` o `depends_on` en tareas) sin perderlos al reescribir.
 */
export const FrontmatterSchema = z
  .object({
    id: z.string().regex(ID_RE, "identificador invalido"),
    type: DocTypeSchema,
    title: z.string().min(3, "el titulo es obligatorio").max(160),
    status: z.string().min(1),
    date: z.string().regex(ISO_DATE_RE, "la fecha debe ser YYYY-MM-DD"),
    tags: z.array(z.string().regex(SLUG_RE)).default([]),
    phase: z.string().regex(PHASE_RE).optional(),
    related: z.array(z.string().regex(ID_RE)).default([]),
    supersedes: z.string().regex(ID_RE).nullable().default(null),
    superseded_by: z.string().regex(ID_RE).nullable().default(null),
    owner: z.string().min(1).max(80).optional(),
  })
  .passthrough()

export type Frontmatter = z.infer<typeof FrontmatterSchema>

/** Un documento de memoria ya cargado y validado. */
export interface MemoryDoc {
  /** Identificador estable, derivado del frontmatter. */
  readonly id: string
  readonly type: DocType
  readonly title: string
  readonly status: string
  readonly date: string
  readonly tags: readonly string[]
  readonly phase?: string
  readonly related: readonly string[]
  readonly supersedes: string | null
  readonly superseded_by: string | null
  readonly owner?: string
  /** Resto de campos del frontmatter, especificos del tipo. */
  readonly extra: Readonly<Record<string, unknown>>
  /** Cuerpo markdown, sin frontmatter. */
  readonly body: string
  /** Ruta relativa a `docs/memory/`, siempre con separador `/`. */
  readonly path: string
}

/**
 * Requisitos que el gate exige SIEMPRE. Deliberadamente no son configurables.
 *
 * La auditoria demostro que exponer `requires_tests`/`requires_doc` como parametros
 * de la herramienta convertia el control central del proyecto en algo que el propio
 * llamante podia desactivar. Un control que se puede apagar desde dentro no es un
 * control. Si una tarea no admite test automatizado, la evidencia lo dice con
 * palabras: el gate comprueba que la evidencia existe, no que sea verdad, y eso es
 * una responsabilidad humana.
 */
export const TASK_REQUIREMENTS = { tests: true, doc: true } as const

/**
 * Resultado de la suite de tests declarado por quien cierra la tarea.
 * `evidence` es obligatorio cuando `passed` es verdadero.
 */
export const TaskTestsSchema = z.object({
  suite: z.string().min(1).default("pnpm test"),
  passed: z.boolean().default(false),
  /** Evidencia obligatoria: fecha, comando y resumen del resultado. */
  evidence: z.string().min(1).nullable().default(null),
})

export type TaskTests = z.infer<typeof TaskTestsSchema>
