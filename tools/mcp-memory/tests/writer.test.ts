import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { SecretDetectedError } from "../src/core/guards.ts"
import { docPath, PathEscapeError } from "../src/core/paths.ts"
import { MemoryStore } from "../src/core/store.ts"
import {
  appendToBody,
  DocumentNotFoundError,
  InvalidFrontmatterError,
  patchFrontmatter,
  upsertBodySection,
  writeDocument,
} from "../src/core/writer.ts"
import { makeMemoryRoot } from "./helpers.ts"

function decisionData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "D-001",
    type: "decision",
    title: "Sin pagos en la app",
    status: "accepted",
    date: "2026-09-27",
    tags: ["producto"],
    ...overrides,
  }
}

function stateData(): Record<string, unknown> {
  return {
    id: "state",
    type: "state",
    title: "Estado actual",
    status: "active",
    date: "2026-09-27",
    tags: [],
  }
}

describe("writeDocument", () => {
  it("escribe un documento valido que luego carga sin incidencias", async () => {
    const root = await makeMemoryRoot()
    const relative = docPath("decision", "D-001", "Sin pagos en la app")

    const result = await writeDocument(
      relative,
      decisionData(),
      "## Decision\n\nEl cobro en el TPV.",
      root,
    )

    expect(result.created).toBe(true)
    expect(result.path).toBe(relative)

    const store = new MemoryStore(root)
    await store.load()
    expect(store.getIssues()).toHaveLength(0)
    expect(store.findById("D-001")?.title).toBe("Sin pagos en la app")
  })

  it("lanza y no crea el fichero cuando el frontmatter es invalido", async () => {
    const root = await makeMemoryRoot()
    const relative = "decisions/d-001-mala.md"
    const invalid: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["id mal formado", decisionData({ id: "D-1" })],
      ["status no permitido para el tipo", decisionData({ status: "todo" })],
      ["tags con mayusculas", decisionData({ tags: ["Producto"] })],
      ["tags con espacios", decisionData({ tags: ["dos palabras"] })],
      ["phase mal formada", decisionData({ phase: "F1.2.3" })],
    ]

    for (const [label, data] of invalid) {
      await expect(writeDocument(relative, data, "Cuerpo de prueba.", root), label).rejects.toThrow(
        InvalidFrontmatterError,
      )
      expect(existsSync(path.join(root, relative)), label).toBe(false)
    }
  })

  it("rechaza un secreto y no crea el fichero", async () => {
    const root = await makeMemoryRoot()
    const relative = "decisions/d-001-secreto.md"

    await expect(
      writeDocument(relative, decisionData(), "Nota.\n\npassword: super-secreta-123", root),
    ).rejects.toThrow(SecretDetectedError)
    expect(existsSync(path.join(root, relative))).toBe(false)
  })

  it("rechaza una ruta que escapa de la memoria", async () => {
    const root = await makeMemoryRoot()

    await expect(writeDocument("../fuera.md", decisionData(), "Cuerpo.", root)).rejects.toThrow(
      PathEscapeError,
    )
  })

  it("escribe el documento unico state en state.md, no en state-<slug>.md", async () => {
    const root = await makeMemoryRoot()
    const relative = docPath("state", "state", "Estado actual")
    expect(relative).toBe("state.md")

    const result = await writeDocument(relative, stateData(), "Fase actual.", root)
    expect(result.path).toBe("state.md")
    expect(existsSync(path.join(root, "state.md"))).toBe(true)
    expect(existsSync(path.join(root, "state-estado-actual.md"))).toBe(false)
  })
})

describe("patchFrontmatter", () => {
  it("cambia solo los campos indicados y conserva el cuerpo", async () => {
    const root = await makeMemoryRoot()
    const relative = docPath("decision", "D-001", "Sin pagos en la app")
    await writeDocument(
      relative,
      decisionData({ status: "proposed", tags: ["uno"] }),
      "## Decision\n\nTexto original.",
      root,
    )

    await patchFrontmatter(relative, { status: "accepted" }, root)

    const store = new MemoryStore(root)
    await store.load()
    const doc = store.findById("D-001")
    expect(doc?.status).toBe("accepted")
    expect(doc?.title).toBe("Sin pagos en la app")
    expect(doc?.tags).toEqual(["uno"])
    expect(doc?.body).toContain("Texto original.")
  })

  it("lanza DocumentNotFoundError si el fichero no existe", async () => {
    const root = await makeMemoryRoot()

    await expect(
      patchFrontmatter("decisions/d-001-inexistente.md", { status: "accepted" }, root),
    ).rejects.toThrow(DocumentNotFoundError)
  })
})

describe("appendToBody", () => {
  it("anade al final sin tocar el frontmatter", async () => {
    const root = await makeMemoryRoot()
    const relative = docPath("decision", "D-001", "Sin pagos en la app")
    await writeDocument(relative, decisionData(), "## Decision\n\nPrimera linea.", root)

    await appendToBody(relative, "- Segunda linea.", root)

    const raw = readFileSync(path.join(root, relative), "utf8")
    expect(raw.startsWith("---\n")).toBe(true)

    const store = new MemoryStore(root)
    await store.load()
    const doc = store.findById("D-001")
    expect(doc?.title).toBe("Sin pagos en la app")
    expect(doc?.body).toContain("Primera linea.")
    expect(doc?.body).toContain("Segunda linea.")
  })
})

describe("upsertBodySection", () => {
  it("reemplaza la seccion existente sin duplicarla", async () => {
    const root = await makeMemoryRoot()
    const relative = docPath("decision", "D-001", "Sin pagos en la app")
    await writeDocument(relative, decisionData(), "## Contexto\n\nContenido viejo.", root)

    await upsertBodySection(relative, "Contexto", "Contenido nuevo.", root)

    const store = new MemoryStore(root)
    await store.load()
    const body = store.findById("D-001")?.body ?? ""
    expect(body).toContain("Contenido nuevo.")
    expect(body).not.toContain("Contenido viejo.")
    expect(body.match(/## Contexto/g)).toHaveLength(1)
  })
})
