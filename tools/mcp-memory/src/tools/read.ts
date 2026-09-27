/**
 * Herramientas de lectura de la memoria.
 *
 * Son de uso libre por cualquier agente: no modifican nada.
 * `memory_context` es la mas importante: produce el briefing con el que el
 * arquitecto delega trabajo en un agente ejecutor.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { MemoryStore } from "../core/store.ts"
import { validateMemory } from "../core/validate.ts"
import { DOC_TYPES, type DocType, type MemoryDoc } from "../schema.ts"
import { asData, DATA_BANNER, run, sanitizeInline } from "./result.ts"

const SCOPE_NOTE =
  "Esta memoria cubre el DESARROLLO del sistema (arquitectura, decisiones, contratos, " +
  "convenciones, roadmap, tareas, riesgos y lecciones). Los datos de producto (cartas, " +
  "pedidos, mesas) viven en Postgres/Supabase y NO estan aqui."

function bullet(doc: MemoryDoc): string {
  // El titulo lo escribe el local: se aplana antes de mostrarlo en una linea.
  const parts = [`- \`${doc.id}\` **${sanitizeInline(doc.title)}** — _${doc.status}_`]
  if (doc.phase !== undefined) parts.push(`· ${doc.phase}`)
  parts.push(`· \`${doc.path}\``)
  return parts.join(" ")
}

function renderDoc(doc: MemoryDoc, includeBody: boolean): string {
  const header = [
    `# ${doc.id} — ${sanitizeInline(doc.title)}`,
    "",
    `- **Tipo:** ${doc.type}`,
    `- **Estado:** ${doc.status}`,
    `- **Fecha:** ${doc.date}`,
    `- **Ruta:** \`${doc.path}\``,
    `- **Etiquetas:** ${doc.tags.length > 0 ? doc.tags.join(", ") : "(ninguna)"}`,
  ]
  if (doc.phase !== undefined) header.push(`- **Fase:** ${doc.phase}`)
  if (doc.owner !== undefined) header.push(`- **Responsable:** ${doc.owner}`)
  if (doc.related.length > 0) header.push(`- **Relacionados:** ${doc.related.join(", ")}`)
  if (doc.supersedes !== null) header.push(`- **Reemplaza a:** ${doc.supersedes}`)
  if (doc.superseded_by !== null) header.push(`- **Reemplazado por:** ${doc.superseded_by}`)

  const extraEntries = Object.entries(doc.extra).filter(([, value]) => value !== null)
  if (extraEntries.length > 0) {
    header.push("", "**Campos adicionales:**")
    for (const [key, value] of extraEntries) {
      header.push(`- \`${key}\`: ${JSON.stringify(value)}`)
    }
  }

  if (!includeBody) return header.join("\n")
  // Se envuelve TODO el documento, cabecera incluida: el titulo lo escribe el local y
  // admite saltos de linea, asi que tambien es contenido no confiable. Dejarlo fuera
  // del marco era una via de inyeccion demostrada por la auditoria.
  return asData(`${header.join("\n")}\n\n---\n\n${doc.body}`, doc.id)
}

function collect(store: MemoryStore, topic: string, type: DocType, limit: number): MemoryDoc[] {
  return store.search(topic, { type, limit }).map((hit) => hit.doc)
}

function relevantGlossaryLines(store: MemoryStore, topic: string): string[] {
  const glossary = store.singleton("glossary")
  if (glossary === undefined) return []
  const terms = topic
    .toLowerCase()
    .split(/[^a-z0-9ñáéíóú]+/u)
    .filter((word) => word.length >= 4)
  if (terms.length === 0) return []
  return glossary.body
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && terms.some((term) => line.toLowerCase().includes(term)))
    .slice(0, 25)
}

export function registerReadTools(server: McpServer, store: MemoryStore): void {
  server.registerTool(
    "memory_overview",
    {
      title: "Vista general de la memoria",
      description:
        "Primera llamada recomendada en cualquier sesion. Devuelve el mapa del proyecto: " +
        "documentos por tipo, fase actual, tareas abiertas y bloqueadas, riesgos y preguntas " +
        "abiertas. NO cubre datos de producto (cartas, pedidos): eso vive en la base de datos.",
      inputSchema: {},
    },
    async () =>
      run(async () => {
        await store.load(true)
        const docs = store.all()
        const byType = new Map<string, number>()
        for (const doc of docs) {
          byType.set(doc.type, (byType.get(doc.type) ?? 0) + 1)
        }

        const lines: string[] = [
          "# Memoria del Proyecto Camarero",
          "",
          `> ${SCOPE_NOTE}`,
          "",
          "## Inventario",
          "",
          `- Documentos cargados: **${docs.length}**`,
        ]
        if (store.getIssues().length > 0) {
          lines.push(
            `- Documentos con error de carga: **${store.getIssues().length}** (usa memory_validate)`,
          )
        }
        lines.push(
          "",
          DOC_TYPES.filter((type) => (byType.get(type) ?? 0) > 0)
            .map((type) => `\`${type}\`: ${byType.get(type) ?? 0}`)
            .join(" · "),
          "",
        )

        const state = store.singleton("state")
        if (state !== undefined) {
          lines.push("## Fase actual", "", asData(state.body.slice(0, 1200), state.id), "")
        }

        const openTasks = store
          .byType("task")
          .filter((doc) => ["todo", "doing", "review", "blocked"].includes(doc.status))
        lines.push(`## Tareas abiertas (${openTasks.length})`, "")
        lines.push(
          ...(openTasks.length === 0
            ? ["(ninguna)"]
            : openTasks
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, 25)
                .map(bullet)),
          "",
        )

        const blocked = openTasks.filter((doc) => doc.status === "blocked")
        if (blocked.length > 0) {
          lines.push("## Bloqueadas", "", ...blocked.map(bullet), "")
        }

        const risks = store
          .byType("risk")
          .filter((doc) => ["open", "mitigating"].includes(doc.status))
        if (risks.length > 0) {
          lines.push("## Riesgos abiertos", "", ...risks.map(bullet), "")
        }

        const questions = store.byType("question").filter((doc) => doc.status === "open")
        if (questions.length > 0) {
          lines.push("## Preguntas abiertas", "", ...questions.map(bullet), "")
        }

        const keyDocs = ["overview", "roadmap", "conventions", "state", "glossary"]
          .map((type) => store.singleton(type as DocType))
          .filter((doc): doc is MemoryDoc => doc !== undefined)
        lines.push("## Documentos base", "", ...keyDocs.map(bullet), "")

        const contracts = store.byType("contract")
        if (contracts.length > 0) {
          lines.push("## Contratos", "", ...contracts.map(bullet), "")
        }

        return lines.join("\n")
      }),
  )

  server.registerTool(
    "memory_context",
    {
      title: "Briefing de contexto",
      description:
        "Devuelve TODO el contexto relevante para trabajar en un tema o cerrar una tarea: " +
        "decisiones y ADRs aplicables, contratos, convenciones, glosario, lecciones y los " +
        "requisitos de rigor exigidos. Usalo ANTES de delegar trabajo a un agente o de " +
        "empezar a escribir codigo. Pasa `topic` o `task_id`.",
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe("Tema a cubrir, por ejemplo 'reparto de cuenta' o 'emparejamiento de mesa'."),
        task_id: z
          .string()
          .optional()
          .describe("Identificador de tarea, por ejemplo TASK-F1-01. Anade su contexto y su gate."),
      },
    },
    async ({ topic, task_id }) =>
      run(async () => {
        await store.load(true)

        const task =
          task_id !== undefined && task_id.trim() !== ""
            ? store.findById(task_id.trim())
            : undefined
        if (task_id !== undefined && task_id.trim() !== "" && task === undefined) {
          throw new Error(`No existe la tarea "${task_id}" en la memoria.`)
        }

        const subject =
          topic !== undefined && topic.trim() !== ""
            ? topic.trim()
            : task !== undefined
              ? `${task.title} ${task.tags.join(" ")}`
              : ""

        const lines: string[] = [
          `# Contexto para: ${subject === "" ? "(general)" : subject}`,
          "",
          `> ${SCOPE_NOTE}`,
          "",
          DATA_BANNER,
          "",
        ]

        if (task !== undefined) {
          lines.push("## Tarea", "", renderDoc(task, false), "", asData(task.body, task.id), "")
          const dependencies = task.extra["depends_on"]
          if (Array.isArray(dependencies) && dependencies.length > 0) {
            lines.push("**Dependencias:**", "")
            for (const dependency of dependencies) {
              const doc = typeof dependency === "string" ? store.findById(dependency) : undefined
              lines.push(
                doc === undefined ? `- \`${String(dependency)}\` (NO EXISTE)` : `- ${bullet(doc)}`,
              )
            }
            lines.push("")
          }
          lines.push(
            "## Requisitos de rigor (gate)",
            "",
            "- No se puede marcar como `done` sin tests en verde y con evidencia registrada.",
            "- No se puede marcar como `done` sin documento asociado existente en la memoria.",
            "- Ninguna dependencia puede quedar sin cerrar.",
            "",
          )
        }

        if (subject === "") {
          const conventions = store.singleton("conventions")
          if (conventions !== undefined) {
            lines.push("## Convenciones", "", asData(conventions.body, conventions.id), "")
          }
          lines.push(
            "Pasa un `topic` o un `task_id` para recibir decisiones, contratos y lecciones aplicables.",
            "",
          )
          return lines.join("\n")
        }

        const groups: { title: string; type: DocType; limit: number }[] = [
          { title: "Decisiones aplicables", type: "decision", limit: 8 },
          { title: "ADRs aplicables", type: "adr", limit: 6 },
          { title: "Contratos aplicables", type: "contract", limit: 5 },
          { title: "Lecciones aplicables", type: "lesson", limit: 5 },
          { title: "Tareas relacionadas", type: "task", limit: 8 },
        ]

        for (const group of groups) {
          const found = collect(store, subject, group.type, group.limit)
          if (found.length === 0) continue
          lines.push(`## ${group.title}`, "", ...found.map(bullet), "")
        }

        const risks = collect(store, subject, "risk", 5)
        if (risks.length > 0) {
          lines.push("## Riesgos relacionados", "", ...risks.map(bullet), "")
        }

        const conventions = store.singleton("conventions")
        if (conventions !== undefined) {
          lines.push(
            "## Convenciones del proyecto",
            "",
            asData(conventions.body, conventions.id),
            "",
          )
        }

        const glossaryLines = relevantGlossaryLines(store, subject)
        if (glossaryLines.length > 0) {
          lines.push("## Glosario relevante", "", ...glossaryLines, "")
        }

        return lines.join("\n")
      }),
  )

  server.registerTool(
    "memory_search",
    {
      title: "Buscar en la memoria",
      description:
        "Busqueda de texto sobre toda la memoria, con filtros por tipo, estado, fase o etiqueta. " +
        "Usala para localizar decisiones previas sobre un tema antes de proponer algo nuevo.",
      inputSchema: {
        query: z.string().min(1).describe("Texto a buscar. Se ignoran acentos y mayusculas."),
        type: z.enum(DOC_TYPES).optional().describe("Limita a un tipo de documento."),
        status: z.string().optional().describe("Limita a un estado, por ejemplo 'open' o 'done'."),
        phase: z.string().optional().describe("Limita a una fase, por ejemplo F1."),
        tag: z.string().optional().describe("Limita a documentos con esa etiqueta."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximo de resultados. Por defecto 10."),
      },
    },
    async (args) =>
      run(async () => {
        await store.load(true)
        const hits = store.search(args.query, {
          ...(args.type !== undefined ? { type: args.type } : {}),
          ...(args.status !== undefined ? { status: args.status } : {}),
          ...(args.phase !== undefined ? { phase: args.phase } : {}),
          ...(args.tag !== undefined ? { tag: args.tag } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        })

        if (hits.length === 0) {
          return `Sin resultados para "${args.query}".\n\nPrueba con menos palabras o sin filtros. Si el tema no esta documentado, es una decision pendiente: usa memory_get("overview") para ver el mapa.`
        }

        return [
          `# Resultados para "${args.query}" (${hits.length})`,
          "",
          ...hits.map((hit) => `${bullet(hit.doc)} · _relevancia ${hit.score}_`),
        ].join("\n")
      }),
  )

  server.registerTool(
    "memory_get",
    {
      title: "Leer un documento",
      description:
        "Devuelve un documento completo por identificador (por ejemplo 'D-012', 'ADR-0002', " +
        "'TASK-F1-01', 'CONTRACT-dinero') o por ruta relativa ('contracts/dinero.md').",
      inputSchema: {
        id_or_path: z.string().min(1).describe("Identificador o ruta relativa del documento."),
      },
    },
    async ({ id_or_path }) =>
      run(async () => {
        await store.load(true)
        const needle = id_or_path.trim()
        const doc = store.findById(needle) ?? store.findByPath(needle)
        if (doc === undefined) {
          const suggestions = store.search(needle, { limit: 5 }).map((hit) => hit.doc)
          const hint =
            suggestions.length > 0
              ? `\n\nQuizas buscabas:\n${suggestions.map(bullet).join("\n")}`
              : ""
          throw new Error(`No existe "${needle}" en la memoria.${hint}`)
        }
        return `${DATA_BANNER}\n\n${renderDoc(doc, true)}`
      }),
  )

  server.registerTool(
    "memory_next",
    {
      title: "Siguiente tarea accionable",
      description:
        "Devuelve la siguiente tarea que puede empezarse ahora (sus dependencias estan cerradas), " +
        "junto con lo que esta bloqueado y por que. Es el punto de partida del ciclo del arquitecto.",
      inputSchema: {},
    },
    async () =>
      run(async () => {
        await store.load(true)
        const tasks = store
          .byType("task")
          .filter((doc) => doc.status === "todo" || doc.status === "blocked")
          .sort((a, b) => a.id.localeCompare(b.id))

        const open = (id: unknown): boolean => {
          if (typeof id !== "string") return false
          const doc = store.findById(id)
          return doc === undefined || doc.status !== "done"
        }

        const actionable = tasks.filter((doc) => {
          const dependencies = doc.extra["depends_on"]
          if (!Array.isArray(dependencies)) return true
          return !dependencies.some(open)
        })

        const blocked = tasks.filter((doc) => !actionable.includes(doc))
        const next = actionable[0]

        const lines: string[] = ["# Siguiente trabajo", ""]
        if (next === undefined) {
          lines.push(
            "No hay tareas accionables. Todas las abiertas estan bloqueadas o no hay tareas creadas.",
            "",
          )
        } else {
          lines.push("## Accionable ahora", "", renderDoc(next, true), "")
          lines.push(
            `Antes de empezar, pide el briefing con \`memory_context\` y \`task_id: "${next.id}"\`.`,
            "",
          )
        }

        if (blocked.length > 0) {
          lines.push("## Bloqueadas", "")
          for (const doc of blocked) {
            const dependencies = doc.extra["depends_on"]
            const pending = Array.isArray(dependencies)
              ? dependencies.filter(open).filter((v): v is string => typeof v === "string")
              : []
            lines.push(
              `${bullet(doc)} → espera a ${pending.join(", ") || "(sin dependencia declarada)"}`,
            )
          }
          lines.push("")
        }

        lines.push("## En curso", "")
        const doing = store
          .byType("task")
          .filter((doc) => doc.status === "doing" || doc.status === "review")
        lines.push(...(doing.length === 0 ? ["(ninguna)"] : doing.map(bullet)))
        lines.push("")

        return lines.join("\n")
      }),
  )

  server.registerTool(
    "memory_validate",
    {
      title: "Validar integridad de la memoria",
      description:
        "Informe de integridad: documentos ilegibles, identificadores duplicados, referencias " +
        "rotas, decisiones aceptadas sin alternativas, tareas cerradas sin evidencia de tests y " +
        "secretos o datos personales detectados. No modifica nada.",
      inputSchema: {},
    },
    async () =>
      run(async () => {
        await store.load(true)
        const issues = validateMemory(store)
        const errors = issues.filter((issue) => issue.severity === "error")
        const warnings = issues.filter((issue) => issue.severity === "warning")

        const lines: string[] = [
          "# Integridad de la memoria",
          "",
          `- Documentos analizados: **${store.all().length}**`,
          `- Errores: **${errors.length}**`,
          `- Avisos: **${warnings.length}**`,
          "",
        ]

        const render = (title: string, list: typeof issues): void => {
          if (list.length === 0) return
          lines.push(`## ${title}`, "")
          for (const issue of list) {
            const where = issue.docId ?? issue.path ?? ""
            lines.push(
              `- **[${issue.code}]** ${where !== "" ? `\`${where}\` — ` : ""}${issue.message}`,
            )
          }
          lines.push("")
        }

        render("Errores", errors)
        render("Avisos", warnings)

        if (issues.length === 0) {
          lines.push("Sin hallazgos. La memoria es coherente.", "")
        }

        return lines.join("\n")
      }),
  )
}
