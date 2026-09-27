import { describe, expect, it } from "vitest"
import {
  FrontmatterError,
  parseMarkdown,
  serializeMarkdown,
  upsertSection,
} from "../src/core/frontmatter.ts"

describe("parseMarkdown", () => {
  it("separa frontmatter y cuerpo", () => {
    const source = "---\nid: D-001\ntitle: Algo\n---\n\nCuerpo del documento.\n"
    const parsed = parseMarkdown(source)
    expect(parsed.data["id"]).toBe("D-001")
    expect(parsed.data["title"]).toBe("Algo")
    expect(parsed.body.trim()).toBe("Cuerpo del documento.")
  })

  it("ignora un BOM al principio", () => {
    const parsed = parseMarkdown("\uFEFF---\nid: D-001\n---\n\nCuerpo.\n")
    expect(parsed.data["id"]).toBe("D-001")
  })

  it("falla si no hay frontmatter", () => {
    expect(() => parseMarkdown("# Sin frontmatter\n")).toThrow(FrontmatterError)
  })

  it("falla si no se cierra el frontmatter", () => {
    expect(() => parseMarkdown("---\nid: D-001\n\nCuerpo sin cierre.\n")).toThrow(FrontmatterError)
  })

  it("falla si el YAML es invalido", () => {
    expect(() => parseMarkdown("---\nid: [sin cerrar\n---\n\nCuerpo.\n")).toThrow(FrontmatterError)
  })

  it("falla si el frontmatter es una lista en lugar de un objeto", () => {
    expect(() => parseMarkdown("---\n- uno\n- dos\n---\n\nCuerpo.\n")).toThrow(FrontmatterError)
  })

  it("acepta cuerpos con lineas que solo tienen ---", () => {
    const source = "---\nid: D-001\n---\n\nAntes\n\n---\n\nDespues\n"
    const parsed = parseMarkdown(source)
    expect(parsed.body).toContain("Antes")
    expect(parsed.body).toContain("Despues")
  })
})

describe("serializeMarkdown", () => {
  it("coloca los campos en orden estable", () => {
    const text = serializeMarkdown({ title: "T", id: "D-001", type: "decision" }, "Cuerpo.")
    const lines = text.split("\n")
    expect(lines[1]?.startsWith("id:")).toBe(true)
    expect(lines[2]?.startsWith("type:")).toBe(true)
    expect(lines[3]?.startsWith("title:")).toBe(true)
  })

  it("es idempotente: parsear y volver a serializar no cambia el contenido", () => {
    const original = serializeMarkdown(
      { id: "D-001", type: "decision", title: "Titulo", tags: ["a", "b"] },
      "Linea uno.\n\nLinea dos.",
    )
    const parsed = parseMarkdown(original)
    const again = serializeMarkdown(parsed.data, parsed.body)
    expect(again).toBe(original)
  })

  it("termina siempre en salto de linea", () => {
    expect(serializeMarkdown({ id: "overview" }, "Cuerpo").endsWith("\n")).toBe(true)
  })
})

describe("upsertSection", () => {
  it("anade una seccion nueva al final", () => {
    const result = upsertSection("Intro.", "Alternativas", "Opcion A, Opcion B.")
    expect(result).toContain("Intro.")
    expect(result).toContain("## Alternativas")
    expect(result).toContain("Opcion A, Opcion B.")
  })

  it("reemplaza el contenido de una seccion existente sin duplicarla", () => {
    const body = "## Contexto\n\nViejo.\n\n## Decision\n\nAlgo."
    const result = upsertSection(body, "Contexto", "Nuevo.")
    expect(result).toContain("Nuevo.")
    expect(result).not.toContain("Viejo.")
    expect(result.match(/## Contexto/g)).toHaveLength(1)
    expect(result).toContain("## Decision")
  })

  it("no confunde secciones con titulos que empiezan igual", () => {
    const body = "## Alternativas consideradas\n\nContenido real."
    const result = upsertSection(body, "Alternativas", "Reemplazo.")
    expect(result.match(/## Alternativas/g)).toHaveLength(1)
    expect(result).toContain("Reemplazo.")
  })
})
