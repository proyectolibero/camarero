import { describe, expect, it } from "vitest"
import { MemoryStore, normalizeText } from "../src/core/store.ts"
import { buildDoc, makeMemoryRoot, writeRawDoc } from "./helpers.ts"

async function seed(): Promise<string> {
  const root = await makeMemoryRoot()
  await writeRawDoc(
    root,
    "decisions/d-001-sin-pagos-en-la-app.md",
    buildDoc(
      {
        id: "D-001",
        type: "decision",
        title: "Sin pagos dentro de la app",
        tags: ["producto", "alcance"],
        phase: "F0",
      },
      "## Decision\n\nEl comensal pide la cuenta; el cobro ocurre en el TPV.",
    ),
  )
  await writeRawDoc(
    root,
    "decisions/d-002-emparejamiento-aprobado.md",
    buildDoc(
      {
        id: "D-002",
        type: "decision",
        title: "Emparejamiento de mesa aprobado por un empleado",
        tags: ["mesa"],
      },
      "## Decision\n\nNinguna mesa se abre sin aprobacion humana.",
    ),
  )
  await writeRawDoc(
    root,
    "adr/adr-0001-stack.md",
    buildDoc(
      { id: "ADR-0001", type: "adr", title: "Stack tecnologico", related: ["D-001"] },
      "## Contexto\n\nNecesitamos un stack barato.\n\n## Alternativas consideradas\n\nOtras opciones.\n\n## Consecuencias\n\nCoste 0.",
    ),
  )
  await writeRawDoc(
    root,
    "overview-vista-general.md",
    buildDoc({ id: "overview", type: "overview", title: "Vista general" }, "Mapa del sistema."),
  )
  return root
}

describe("MemoryStore.load", () => {
  it("carga los documentos validos", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(store.all()).toHaveLength(4)
    expect(store.getIssues()).toHaveLength(0)
  })

  it("clasifica como incidencia un documento con frontmatter invalido", async () => {
    const root = await seed()
    await writeRawDoc(root, "decisions/d-999-roto.md", "# Sin frontmatter\n")
    const store = new MemoryStore(root)

    await store.load()
    expect(store.all()).toHaveLength(4)
    expect(store.getIssues()).toHaveLength(1)
    expect(store.getIssues()[0]?.message).toContain("frontmatter")
  })

  it("rechaza un estado que no corresponde al tipo", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "tasks/task-f1-01-mala.md",
      buildDoc({ id: "TASK-F1-01", type: "task", title: "Mala", status: "inventado" }),
    )
    const store = new MemoryStore(root)

    await store.load()
    expect(store.all()).toHaveLength(0)
    expect(store.getIssues()[0]?.message).toContain("no permitido")
  })

  it("ignora los ficheros que no son markdown", async () => {
    const root = await seed()
    await writeRawDoc(root, "notas.txt", "contenido suelto")
    const store = new MemoryStore(root)

    await store.load()
    expect(store.all()).toHaveLength(4)
  })

  it("solo recarga cuando se le pide", async () => {
    const root = await seed()
    const store = new MemoryStore(root)
    await store.load()

    await writeRawDoc(
      root,
      "questions/oq-001-nombre.md",
      buildDoc({ id: "OQ-001", type: "question", title: "Nombre del producto" }),
    )

    expect(store.all()).toHaveLength(4)
    await store.load(true)
    expect(store.all()).toHaveLength(5)
  })
})

describe("MemoryStore: consultas", () => {
  it("encuentra por identificador sin distinguir mayusculas", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(store.findById("d-001")?.title).toBe("Sin pagos dentro de la app")
    expect(store.findById("ADR-0001")?.type).toBe("adr")
  })

  it("busca ignorando acentos y mayusculas", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    const hits = store.search("emparejamiento")
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.doc.id).toBe("D-002")
  })

  it("filtra por tipo, etiqueta y fase", async () => {
    const store = new MemoryStore(await seed())
    await store.load()

    expect(store.search("stack", { type: "adr" }).map((hit) => hit.doc.id)).toEqual(["ADR-0001"])
    expect(store.search("stack", { type: "risk" })).toHaveLength(0)
    expect(store.search("mesa", { tag: "mesa" }).map((hit) => hit.doc.id)).toEqual(["D-002"])
    expect(store.search("pagos", { phase: "F0" }).map((hit) => hit.doc.id)).toEqual(["D-001"])
  })

  it("prioriza el titulo sobre el cuerpo", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    const hits = store.search("emparejamiento")
    expect(hits[0]?.score).toBeGreaterThan(hits.length > 1 ? (hits[1]?.score ?? 0) : 0)
  })

  it("respeta el limite de resultados", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(store.search("mesa", { limit: 1 })).toHaveLength(1)
  })

  it("devuelve el singleton por tipo", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(store.singleton("overview")?.id).toBe("overview")
    expect(store.singleton("roadmap")).toBeUndefined()
  })

  it("comprueba la existencia de una ruta", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(store.has("adr/adr-0001-stack.md")).toBe(true)
    expect(store.has("adr\\adr-0001-stack.md")).toBe(true)
    expect(store.has("no/existe.md")).toBe(false)
  })
})

describe("MemoryStore.nextId", () => {
  it("empieza en 001 cuando no hay ninguno", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(store.nextId("risk")).toBe("RISK-001")
    expect(store.nextId("adr")).toBe("ADR-0002")
  })

  it("continua desde el mayor existente, no desde el ultimo alfabetico", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "decisions/d-003-c.md",
      buildDoc({ id: "D-003", type: "decision", title: "Tercera" }),
    )
    await writeRawDoc(
      root,
      "decisions/d-001-a.md",
      buildDoc({ id: "D-001", type: "decision", title: "Primera" }),
    )
    const store = new MemoryStore(root)

    await store.load()
    expect(store.nextId("decision")).toBe("D-004")
  })

  it("numera las tareas por fase", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "tasks/task-f1-01-a.md",
      buildDoc({ id: "TASK-F1-01", type: "task", title: "Primera" }),
    )
    await writeRawDoc(
      root,
      "tasks/task-f2-01-b.md",
      buildDoc({ id: "TASK-F2-01", type: "task", title: "Otra fase" }),
    )
    const store = new MemoryStore(root)

    await store.load()
    expect(store.nextId("task", "F1")).toBe("TASK-F1-02")
    expect(store.nextId("task", "F2")).toBe("TASK-F2-02")
    expect(store.nextId("task", "F3")).toBe("TASK-F3-01")
  })

  it("exige la fase para las tareas", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(() => store.nextId("task")).toThrow(/fase/)
  })

  it("rechaza tipos que no admiten numeracion", async () => {
    const store = new MemoryStore(await seed())
    await store.load()
    expect(() => store.nextId("overview")).toThrow(/numeracion/)
  })
})

describe("normalizeText", () => {
  it("quita acentos y pasa a minusculas", () => {
    expect(normalizeText("Aprobación de MESA")).toBe("aprobacion de mesa")
  })
})
