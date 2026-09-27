/**
 * Utilidades compartidas por los tests.
 *
 * Cada test trabaja sobre un arbol de memoria temporal: jamas toca docs/memory real.
 */
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

export async function makeMemoryRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "camarero-memory-"))
}

export async function writeRawDoc(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absolute = path.join(root, relativePath)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, content, "utf8")
}

export interface DocFields {
  readonly id: string
  readonly type: string
  readonly title?: string
  readonly status?: string
  readonly date?: string
  readonly tags?: readonly string[]
  readonly phase?: string
  readonly related?: readonly string[]
  readonly extra?: Readonly<Record<string, unknown>>
}

/** Construye un documento valido en texto, con los valores por defecto del esquema. */
export function buildDoc(fields: DocFields, body = "Contenido de prueba."): string {
  const lines = [
    "---",
    `id: ${fields.id}`,
    `type: ${fields.type}`,
    `title: ${fields.title ?? "Titulo de prueba"}`,
    `status: ${fields.status ?? defaultStatus(fields.type)}`,
    `date: ${fields.date ?? "2026-09-27"}`,
    `tags: [${(fields.tags ?? []).join(", ")}]`,
  ]
  if (fields.phase !== undefined) lines.push(`phase: ${fields.phase}`)
  if (fields.related !== undefined && fields.related.length > 0) {
    lines.push(`related: [${fields.related.join(", ")}]`)
  }
  for (const [key, value] of Object.entries(fields.extra ?? {})) {
    lines.push(`${key}: ${JSON.stringify(value)}`)
  }
  lines.push("---", "", body, "")
  return lines.join("\n")
}

function defaultStatus(type: string): string {
  switch (type) {
    case "adr":
      return "accepted"
    case "decision":
      return "accepted"
    case "task":
      return "todo"
    case "risk":
      return "open"
    case "question":
      return "open"
    case "lesson":
      return "recorded"
    case "contract":
      return "active"
    case "log":
      return "append-only"
    default:
      return "active"
  }
}
