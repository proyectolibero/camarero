/**
 * Lectura y escritura del frontmatter YAML de un documento de memoria.
 *
 * No se usa un parser markdown completo: el contrato es
 * "frontmatter delimitado por --- al principio del fichero, y cuerpo libre despues".
 */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"

const DELIMITER = "---"

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FrontmatterError"
  }
}

export interface ParsedMarkdown {
  readonly data: Record<string, unknown>
  readonly body: string
}

export function parseMarkdown(source: string): ParsedMarkdown {
  const text = source.replace(/^\uFEFF/, "")
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== DELIMITER) {
    throw new FrontmatterError(
      "El documento no empieza por frontmatter. Debe comenzar con una linea '---'.",
    )
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === DELIMITER)
  if (closing === -1) {
    throw new FrontmatterError("El frontmatter no tiene delimitador de cierre '---'.")
  }

  const frontmatterText = lines.slice(1, closing).join("\n")
  const body = lines.slice(closing + 1).join("\n")

  let data: unknown
  try {
    data = parseYaml(frontmatterText)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new FrontmatterError(`YAML invalido en el frontmatter: ${detail}`)
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new FrontmatterError("El frontmatter debe ser un objeto YAML.")
  }

  return { data: data as Record<string, unknown>, body }
}

const KEY_ORDER = [
  "id",
  "type",
  "title",
  "status",
  "date",
  "phase",
  "owner",
  "tags",
  "related",
  "supersedes",
  "superseded_by",
]

function orderKeys(data: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(data)
  entries.sort(([a], [b]) => {
    const ia = KEY_ORDER.indexOf(a)
    const ib = KEY_ORDER.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
  return Object.fromEntries(entries)
}

/** Serializa con un orden de campos estable, para que los diffs de git sean legibles. */
export function serializeMarkdown(data: Record<string, unknown>, body: string): string {
  const yamlText = stringifyYaml(orderKeys(data), { lineWidth: 0 }).trimEnd()
  const cleanBody = body.replace(/^\s*\n/, "").trimEnd()
  return `${DELIMITER}\n${yamlText}\n${DELIMITER}\n\n${cleanBody}\n`
}

/**
 * Localiza una seccion de primer nivel (`## Titulo`) dentro del cuerpo.
 * Devuelve el rango de lineas para poder reemplazarla sin tocar el resto.
 */
export function findSection(body: string, heading: string): { start: number; end: number } | null {
  const lines = body.split(/\r?\n/)
  // Coincidencia por limite de palabra, no por igualdad exacta: "## Alternativas"
  // debe encontrar "## Alternativas consideradas", que es como se escribe en la
  // practica. Sin esto, cada actualizacion duplicaria la seccion.
  const escaped = heading.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const target = new RegExp(`^##\\s+${escaped}\\b`, "i")
  const start = lines.findIndex((line) => target.test(line))
  if (start === -1) return null

  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i]?.startsWith("## ")) {
      end = i
      break
    }
  }
  return { start, end }
}

/** Reemplaza (o anade al final) una seccion `## Titulo` del cuerpo. */
export function upsertSection(body: string, heading: string, content: string): string {
  const lines = body.split(/\r?\n/)
  const range = findSection(body, heading)
  const block = `## ${heading}\n\n${content.trim()}`

  if (range === null) {
    const prefix = body.trimEnd()
    return prefix === "" ? block : `${prefix}\n\n${block}`
  }

  const before = lines.slice(0, range.start).join("\n").trimEnd()
  const after = lines.slice(range.end).join("\n").trimEnd()
  return [before, block, after].filter((part) => part !== "").join("\n\n")
}
