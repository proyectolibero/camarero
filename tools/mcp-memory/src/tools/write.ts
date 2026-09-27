/**
 * Herramientas de escritura de la memoria.
 *
 * Reglas que aplica esta capa:
 *  - Los tipos append-only (adr, decision, lesson, log) nunca se reescriben.
 *  - `doc_upsert` solo acepta tipos mutables.
 *  - Cerrar una tarea pasa obligatoriamente por el gate de rigor.
 *  - Toda escritura hereda la guarda de secretos y la frontera docs/memory.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { docPath } from "../core/paths.ts"
import type { MemoryStore } from "../core/store.ts"
import { assertTaskGate, integrityErrors } from "../core/validate.ts"
import { appendToBody, patchFrontmatter, writeDocument } from "../core/writer.ts"
import {
  type DocType,
  type MemoryDoc,
  MUTABLE_TYPES,
  PHASE_RE,
  SINGLETON_TYPES,
  SLUG_RE,
  TASK_STATUSES,
} from "../schema.ts"
import { run } from "./result.ts"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface CreateDocInput {
  readonly type: DocType
  readonly id: string
  readonly title: string
  readonly status: string
  readonly tags?: readonly string[]
  readonly phase?: string
  readonly related?: readonly string[]
  readonly body: string
  readonly extra?: Record<string, unknown>
}

async function createDoc(store: MemoryStore, input: CreateDocInput): Promise<MemoryDoc> {
  const relative = docPath(input.type, input.id, input.title)
  const data: Record<string, unknown> = {
    id: input.id,
    type: input.type,
    title: input.title,
    status: input.status,
    date: today(),
    tags: input.tags ?? [],
    related: input.related ?? [],
    ...(input.phase !== undefined ? { phase: input.phase } : {}),
    ...(input.extra ?? {}),
  }

  await writeDocument(relative, data, input.body, store.getRoot())
  await store.load(true)

  const created = store.findById(input.id)
  if (created === undefined) {
    throw new Error(`El documento "${input.id}" no se pudo releer tras escribirlo.`)
  }
  return created
}

function renderCreated(doc: MemoryDoc, extraNote = ""): string {
  return [
    `Creado \`${doc.id}\` — **${doc.title}**`,
    "",
    `- Ruta: \`${doc.path}\``,
    `- Estado: ${doc.status}`,
    extraNote === "" ? "" : `- ${extraNote}`,
  ]
    .filter((line) => line !== "")
    .join("\n")
}

export function registerWriteTools(server: McpServer, store: MemoryStore): void {
  server.registerTool(
    "adr_create",
    {
      title: "Registrar un ADR",
      description:
        "Crea una decision de arquitectura inmutable. Exige declarar alternativas descartadas: " +
        "sin alternativas no hay decision, solo una preferencia. Los ADR no se editan nunca; " +
        "si cambia el criterio, se crea otro ADR y se marca el anterior como reemplazado.",
      inputSchema: {
        title: z.string().min(3).describe("Titulo corto de la decision."),
        context: z.string().min(10).describe("Que problema o fuerza obliga a decidir."),
        decision: z.string().min(10).describe("Que se decide, en presente y en una frase."),
        alternatives: z
          .string()
          .min(10)
          .describe("Alternativas consideradas y por que se descartaron. Obligatorio."),
        consequences: z.string().min(10).describe("Que ganamos y que perdemos. Se honesto."),
        status: z.enum(["proposed", "accepted"]).optional().describe("Por defecto 'accepted'."),
        tags: z.array(z.string()).optional(),
        related: z.array(z.string()).optional(),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)
        const id = store.nextId("adr")
        const body = [
          "## Contexto",
          "",
          args.context,
          "",
          "## Decision",
          "",
          args.decision,
          "",
          "## Alternativas consideradas",
          "",
          args.alternatives,
          "",
          "## Consecuencias",
          "",
          args.consequences,
        ].join("\n")

        const doc = await createDoc(store, {
          type: "adr",
          id,
          title: args.title,
          status: args.status ?? "accepted",
          body,
          ...(args.tags !== undefined ? { tags: args.tags } : {}),
          ...(args.related !== undefined ? { related: args.related } : {}),
        })
        return renderCreated(doc, "Recuerda enlazarlo desde la decision o tarea que lo motiva.")
      }),
  )

  server.registerTool(
    "decision_record",
    {
      title: "Registrar una decision de producto o proceso",
      description:
        "Registra una decision que no es de arquitectura (alcance, producto, proceso, negocio). " +
        "Inmutable y numerada. Exige justificacion y alternativas.",
      inputSchema: {
        title: z.string().min(3),
        decision: z.string().min(10).describe("Que se decide."),
        rationale: z.string().min(10).describe("Por que."),
        alternatives: z.string().min(10).describe("Que otras opciones habia y por que no."),
        status: z.enum(["proposed", "accepted"]).optional(),
        phase: z.string().optional().describe("Fase a la que pertenece, por ejemplo F1."),
        tags: z.array(z.string()).optional(),
        related: z.array(z.string()).optional(),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)
        const id = store.nextId("decision")
        const body = [
          "## Decision",
          "",
          args.decision,
          "",
          "## Justificacion",
          "",
          args.rationale,
          "",
          "## Alternativas",
          "",
          args.alternatives,
        ].join("\n")

        const doc = await createDoc(store, {
          type: "decision",
          id,
          title: args.title,
          status: args.status ?? "accepted",
          body,
          ...(args.tags !== undefined ? { tags: args.tags } : {}),
          ...(args.related !== undefined ? { related: args.related } : {}),
          ...(args.phase !== undefined ? { phase: args.phase } : {}),
        })
        return renderCreated(doc)
      }),
  )

  server.registerTool(
    "task_create",
    {
      title: "Crear una tarea",
      description:
        "Crea una tarea con sus criterios de aceptacion. Una tarea sin criterios de aceptacion " +
        "no puede cerrarse: el gate lo rechaza. Declara `depends_on` para que memory_next sepa " +
        "el orden real de trabajo.",
      inputSchema: {
        title: z.string().min(3),
        phase: z.string().regex(PHASE_RE).describe("Fase, por ejemplo F0 o F1."),
        description: z.string().min(10).describe("Que hay que hacer y por que."),
        acceptance: z
          .array(z.string().min(5))
          .min(1)
          .describe("Criterios de aceptacion verificables. Al menos uno."),
        depends_on: z.array(z.string()).optional().describe("Identificadores de tareas previas."),
        doc: z.string().optional().describe("Ruta del documento de diseño asociado."),
        owner: z.string().optional(),
        tags: z.array(z.string().regex(SLUG_RE)).optional(),
        related: z.array(z.string()).optional(),
        suite: z.string().optional().describe("Comando de tests, por ejemplo 'pnpm test'."),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)
        const id = store.nextId("task", args.phase)
        const criteria = args.acceptance.map((item) => `- [ ] ${item}`).join("\n")
        const body = [
          "## Descripcion",
          "",
          args.description,
          "",
          "## Aceptacion",
          "",
          criteria,
        ].join("\n")

        const doc = await createDoc(store, {
          type: "task",
          id,
          title: args.title,
          status: "todo",
          body,
          phase: args.phase.toUpperCase(),
          ...(args.tags !== undefined ? { tags: args.tags } : {}),
          ...(args.related !== undefined ? { related: args.related } : {}),
          ...(args.owner !== undefined ? { owner: args.owner } : {}),
          extra: {
            acceptance: [...args.acceptance],
            depends_on: args.depends_on ?? [],
            // Los requisitos del gate son fijos (TASK_REQUIREMENTS) y no se escriben
            // aqui: exponerlos como campo permitia al llamante desactivar el control.
            tests: {
              suite: args.suite ?? "pnpm test",
              passed: false,
              evidence: null,
            },
            doc: args.doc ?? null,
          },
        })
        return renderCreated(doc, "Empieza pidiendo memory_context con esta tarea.")
      }),
  )

  server.registerTool(
    "task_update",
    {
      title: "Actualizar una tarea",
      description:
        "Cambia el estado de una tarea y registra la evidencia de tests. Pasar a 'done' dispara " +
        "el gate de rigor: rechaza el cierre si faltan tests en verde con evidencia, si falta el " +
        "documento asociado o si alguna dependencia sigue abierta.",
      inputSchema: {
        id: z.string().min(3).describe("Identificador de la tarea, por ejemplo TASK-F1-01."),
        status: z.enum(TASK_STATUSES).optional(),
        tests_passed: z.boolean().optional().describe("Resultado real de la suite de tests."),
        evidence: z
          .string()
          .optional()
          .describe("Evidencia verificable: comando y resumen del resultado, con fecha."),
        suite: z.string().optional(),
        doc: z.string().optional().describe("Ruta del documento de diseño asociado."),
        notes: z.string().optional().describe("Nota que se anade al historial de la tarea."),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)
        const current = store.findById(args.id)
        if (current === undefined) {
          throw new Error(`No existe la tarea "${args.id}".`)
        }
        if (current.type !== "task") {
          throw new Error(`"${args.id}" es de tipo "${current.type}", no es una tarea.`)
        }

        const previousTests = (current.extra["tests"] ?? {}) as Record<string, unknown>
        const tests: Record<string, unknown> = {
          suite: args.suite ?? previousTests["suite"] ?? "pnpm test",
          passed: args.tests_passed ?? previousTests["passed"] ?? false,
          evidence: args.evidence ?? previousTests["evidence"] ?? null,
        }
        const docRef = args.doc ?? current.extra["doc"] ?? null
        const nextStatus = args.status ?? current.status

        // El gate se evalua por el estado RESULTANTE, no por lo que pida la peticion.
        // La auditoria demostro que una actualizacion sin `status` dejaba una tarea
        // cerrada con los tests en rojo, esquivando el control.
        if (nextStatus === "done") {
          assertTaskGate(
            {
              ...current,
              status: "done",
              extra: { ...current.extra, tests, doc: docRef },
            },
            store,
          )
        }

        const patch: Record<string, unknown> = { status: nextStatus, tests, doc: docRef }
        await patchFrontmatter(current.path, patch, store.getRoot())

        if (args.notes !== undefined && args.notes.trim() !== "") {
          const hasNotes = /^##\s+notas\b/im.test(current.body)
          const prefix = hasNotes ? "" : "## Notas\n\n"
          await appendToBody(
            current.path,
            `${prefix}- **${today()}** — ${args.notes.trim()}`,
            store.getRoot(),
          )
        }

        await store.load(true)
        const updated = store.findById(args.id)
        return [
          `Actualizado \`${args.id}\``,
          "",
          `- Estado: ${current.status} → **${nextStatus}**`,
          `- Tests: ${tests["passed"] === true ? "en verde" : "sin verificar"}`,
          `- Evidencia: ${tests["evidence"] === null ? "(pendiente)" : String(tests["evidence"])}`,
          `- Documento: ${docRef === null ? "(pendiente)" : String(docRef)}`,
          "",
          updated !== undefined ? `Ruta: \`${updated.path}\`` : "",
        ]
          .filter((line) => line !== "")
          .join("\n")
      }),
  )

  server.registerTool(
    "record_append",
    {
      title: "Registrar riesgo, pregunta, leccion o entrada de bitacora",
      description:
        "Anade un registro inmutable. `kind` decide el tipo: risk (riesgo con probabilidad, " +
        "impacto y mitigacion), question (pregunta abierta al humano), lesson (error y su " +
        "prevencion, obligatorio tras cada fallo) o log (entrada de bitacora del proyecto).",
      inputSchema: {
        kind: z.enum(["risk", "question", "lesson", "log"]),
        title: z.string().min(3),
        detail: z.string().optional().describe("Detalle libre. Recomendado en todos los tipos."),
        likelihood: z.enum(["baja", "media", "alta"]).optional().describe("Solo para risk."),
        impact: z.enum(["bajo", "medio", "alto"]).optional().describe("Solo para risk."),
        mitigation: z.string().optional().describe("Solo para risk. Obligatorio."),
        error: z.string().optional().describe("Solo para lesson. Obligatorio."),
        cause: z.string().optional().describe("Solo para lesson. Obligatorio."),
        prevention: z.string().optional().describe("Solo para lesson. Obligatorio."),
        next_step: z.string().optional().describe("Solo para log."),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)

        if (args.kind === "risk") {
          if (args.mitigation === undefined || args.mitigation.trim() === "") {
            throw new Error("Un riesgo sin mitigacion no sirve de nada: falta `mitigation`.")
          }
          const id = store.nextId("risk")
          const body = [
            "## Riesgo",
            "",
            args.detail ?? "(sin detalle)",
            "",
            "## Evaluacion",
            "",
            `- Probabilidad: ${args.likelihood ?? "media"}`,
            `- Impacto: ${args.impact ?? "medio"}`,
            "",
            "## Mitigacion",
            "",
            args.mitigation,
          ].join("\n")
          const doc = await createDoc(store, {
            type: "risk",
            id,
            title: args.title,
            status: "open",
            body,
            ...(args.tags !== undefined ? { tags: args.tags } : {}),
            extra: {
              likelihood: args.likelihood ?? "media",
              impact: args.impact ?? "medio",
            },
          })
          return renderCreated(doc)
        }

        if (args.kind === "question") {
          const id = store.nextId("question")
          const body = args.detail ?? "(sin detalle)"
          const doc = await createDoc(store, {
            type: "question",
            id,
            title: args.title,
            status: "open",
            body,
            ...(args.tags !== undefined ? { tags: args.tags } : {}),
          })
          return renderCreated(doc, "Una pregunta abierta bloquea decisiones: resolvela pronto.")
        }

        if (args.kind === "lesson") {
          if (
            args.error === undefined ||
            args.cause === undefined ||
            args.prevention === undefined
          ) {
            throw new Error(
              "Una leccion exige `error`, `cause` y `prevention`. Sin causa raiz no hay aprendizaje.",
            )
          }
          const id = store.nextId("lesson")
          const body = [
            "## Error",
            "",
            args.error,
            "",
            "## Causa raiz",
            "",
            args.cause,
            "",
            "## Prevencion",
            "",
            args.prevention,
            ...(args.detail !== undefined ? ["", "## Detalle", "", args.detail] : []),
          ].join("\n")
          const doc = await createDoc(store, {
            type: "lesson",
            id,
            title: args.title,
            status: "recorded",
            body,
            ...(args.tags !== undefined ? { tags: args.tags } : {}),
          })
          return renderCreated(doc)
        }

        const log = store.singleton("log")
        const entry = [
          `## [${today()}] ${args.title}`,
          "",
          args.detail ?? "",
          args.next_step !== undefined ? `\n**Siguiente paso:** ${args.next_step}` : "",
        ]
          .join("\n")
          .trim()

        if (log === undefined) {
          const doc = await createDoc(store, {
            type: "log",
            id: "log",
            title: "Bitacora del proyecto",
            status: "append-only",
            body: `# Bitacora\n\nRegistro cronologico de lo que ocurre en el proyecto.\n\n${entry}`,
          })
          return renderCreated(doc)
        }

        await appendToBody(log.path, entry, store.getRoot())
        await store.load(true)
        return `Entrada anadida a la bitacora.\n\n- Ruta: \`${log.path}\`\n- Titulo: ${args.title}`
      }),
  )

  server.registerTool(
    "doc_upsert",
    {
      title: "Actualizar un documento mutable",
      description:
        "Reemplaza el contenido de un documento mutable: overview, glossary, conventions, " +
        "state, roadmap o contract. Los documentos inmutables (ADR, decisiones, lecciones, " +
        "bitacora) NO se pueden tocar con esta herramienta: se crean y solo crecen.",
      inputSchema: {
        type: z.enum(MUTABLE_TYPES),
        title: z.string().min(3),
        body: z.string().min(1).describe("Cuerpo markdown completo, sin frontmatter."),
        slug: z
          .string()
          .optional()
          .describe("Obligatorio para contract: identificador corto, por ejemplo 'dinero'."),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
        related: z.array(z.string()).optional(),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)
        const isSingleton = (SINGLETON_TYPES as readonly string[]).includes(args.type)

        let id: string
        let status = args.status ?? "active"
        if (args.type === "contract") {
          if (args.slug === undefined || args.slug.trim() === "") {
            throw new Error(
              "Un contrato necesita `slug`, por ejemplo 'dinero' o 'estados-comanda'.",
            )
          }
          const slug = args.slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
          if (slug === "") {
            throw new Error("El `slug` del contrato no puede quedar vacio.")
          }
          id = `CONTRACT-${slug}`
          if (args.status === undefined) {
            status = store.findById(id)?.status ?? "draft"
          }
        } else if (isSingleton) {
          id = args.type
        } else {
          throw new Error(`El tipo "${args.type}" no se puede escribir con doc_upsert.`)
        }

        // Si el documento ya existe se escribe en SU ruta, no en una derivada del
        // titulo nuevo. Antes, cambiar el titulo creaba un fichero nuevo y dejaba el
        // anterior huerfano; con dos documentos del mismo tipo, el duplicado podia
        // sombrear al original y el singleton que leen los agentes pasaba a ser el otro.
        const existing = store.findById(id)
        const relative = existing?.path ?? docPath(args.type, id, args.title)
        const data: Record<string, unknown> = {
          id,
          type: args.type,
          title: args.title,
          status,
          date: today(),
          tags: args.tags ?? [],
          related: args.related ?? [],
        }
        await writeDocument(relative, data, args.body, store.getRoot())
        await store.load(true)

        const issues = integrityErrors(store)
        const note =
          issues.length === 0
            ? "La memoria valida sin errores."
            : `Aviso: la memoria tiene ${issues.length} error(es) de integridad. Ejecuta memory_validate.`

        return [`Escrito \`${id}\` en \`${relative}\`.`, "", note].join("\n")
      }),
  )

  server.registerTool(
    "memory_ping",
    {
      title: "Comprobar la memoria",
      description:
        "Comprobacion de salud: raiz de la memoria, numero de documentos y coherencia basica. " +
        "Util como primera llamada para verificar que el servidor apunta al sitio correcto.",
      inputSchema: {},
    },
    async () =>
      run(async () => {
        await store.load(true)
        const issues = integrityErrors(store)
        const stale = store
          .byType("task")
          .filter((doc) => doc.status === "done")
          .filter((doc) => {
            const tests = doc.extra["tests"]
            if (tests === null || typeof tests !== "object") return true
            return (tests as Record<string, unknown>)["passed"] !== true
          })

        return [
          "# Salud de la memoria",
          "",
          `- Raiz: \`${store.getRoot()}\``,
          `- Documentos: **${store.all().length}**`,
          `- Documentos ilegibles: **${store.getIssues().length}**`,
          `- Errores de integridad: **${issues.length}**`,
          `- Tareas cerradas sin tests en verde: **${stale.length}**`,
        ].join("\n")
      }),
  )
}
