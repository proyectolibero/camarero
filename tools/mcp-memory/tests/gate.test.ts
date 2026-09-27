import { describe, expect, it } from "vitest"
import { MemoryStore } from "../src/core/store.ts"
import { assertTaskGate, GateError, validateMemory } from "../src/core/validate.ts"
import type { MemoryDoc } from "../src/schema.ts"
import { buildDoc, makeMemoryRoot, writeRawDoc } from "./helpers.ts"

interface TaskOptions {
  readonly status?: string
  readonly tests?: Record<string, unknown>
  readonly doc?: string | null
  readonly dependsOn?: readonly string[]
  readonly requires?: unknown
  readonly acceptance?: readonly string[]
}

async function writeTask(
  root: string,
  relative: string,
  id: string,
  options: TaskOptions = {},
): Promise<void> {
  const extra: Record<string, unknown> = {
    acceptance: options.acceptance ?? ["criterio verificable"],
    doc: options.doc ?? null,
  }
  if (options.tests !== undefined) extra["tests"] = options.tests
  if (options.dependsOn !== undefined) extra["depends_on"] = options.dependsOn
  if (options.requires !== undefined) extra["requires"] = options.requires

  await writeRawDoc(
    root,
    relative,
    buildDoc(
      {
        id,
        type: "task",
        title: "Una tarea de prueba",
        status: options.status ?? "todo",
        extra,
      },
      "## Descripcion\n\nAlgo que hacer.",
    ),
  )
}

async function seedAdr(root: string): Promise<string> {
  const relative = "adr/adr-0001-stack.md"
  await writeRawDoc(
    root,
    relative,
    buildDoc(
      { id: "ADR-0001", type: "adr", title: "Stack tecnologico" },
      "## Alternativas\n\nOtras opciones que se descartaron.",
    ),
  )
  return relative
}

function mustFind(store: MemoryStore, id: string): MemoryDoc {
  const doc = store.findById(id)
  if (doc === undefined) throw new Error(`No se encontro "${id}" en el store de prueba.`)
  return doc
}

function gateCodes(task: MemoryDoc, store: MemoryStore): string[] {
  try {
    assertTaskGate(task, store)
    return []
  } catch (error) {
    if (error instanceof GateError) return error.issues.map((issue) => issue.code)
    throw error
  }
}

const validTests = (): Record<string, unknown> => ({
  suite: "npm test",
  passed: true,
  evidence: "2026-09-27 npm test 62 pasan, 0 fallan",
})

describe("assertTaskGate", () => {
  it("rechaza una tarea done sin tests (gate-tests)", async () => {
    const root = await makeMemoryRoot()
    const adr = await seedAdr(root)
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", { status: "done", doc: adr })
    const store = new MemoryStore(root)
    await store.load()

    expect(gateCodes(mustFind(store, "TASK-F1-01"), store)).toContain("gate-tests")
  })

  it("rechaza tests en verde sin evidencia (gate-evidencia)", async () => {
    const root = await makeMemoryRoot()
    const adr = await seedAdr(root)
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      status: "done",
      doc: adr,
      tests: { suite: "npm test", passed: true, evidence: null },
    })
    const store = new MemoryStore(root)
    await store.load()

    expect(gateCodes(mustFind(store, "TASK-F1-01"), store)).toContain("gate-evidencia")
  })

  it("rechaza el cierre sin documento asociado (gate-documentacion)", async () => {
    const root = await makeMemoryRoot()
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      status: "done",
      doc: null,
      tests: validTests(),
    })
    const store = new MemoryStore(root)
    await store.load()

    expect(gateCodes(mustFind(store, "TASK-F1-01"), store)).toContain("gate-documentacion")
  })

  it("rechaza el cierre con una dependencia abierta (gate-dependencia)", async () => {
    const root = await makeMemoryRoot()
    const adr = await seedAdr(root)
    await writeTask(root, "tasks/task-f1-99-dependencia.md", "TASK-F1-99", { status: "todo" })
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      status: "done",
      doc: adr,
      tests: validTests(),
      dependsOn: ["TASK-F1-99"],
    })
    const store = new MemoryStore(root)
    await store.load()

    expect(gateCodes(mustFind(store, "TASK-F1-01"), store)).toContain("gate-dependencia")
  })

  it("no lanza cuando tests, evidencia y documento estan correctos", async () => {
    const root = await makeMemoryRoot()
    const adr = await seedAdr(root)
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      status: "done",
      doc: adr,
      tests: validTests(),
    })
    const store = new MemoryStore(root)
    await store.load()

    expect(() => assertTaskGate(mustFind(store, "TASK-F1-01"), store)).not.toThrow()
  })
})

describe("gate no configurable", () => {
  it("validateMemory marca gate-no-configurable cuando requires intenta apagar el gate", async () => {
    const root = await makeMemoryRoot()
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      requires: { tests: false },
    })
    const store = new MemoryStore(root)
    await store.load()

    const issues = validateMemory(store).filter((issue) => issue.code === "gate-no-configurable")
    expect(issues).toHaveLength(1)
    expect(issues[0]?.severity).toBe("error")
  })

  it("validateMemory marca gate-no-configurable cuando requires apaga el requisito de documento", async () => {
    const root = await makeMemoryRoot()
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      requires: { doc: false },
    })
    const store = new MemoryStore(root)
    await store.load()

    expect(validateMemory(store).map((issue) => issue.code)).toContain("gate-no-configurable")
  })

  it("validateMemory marca gate-no-configurable ante un requires malformado", async () => {
    const root = await makeMemoryRoot()
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", { requires: "x" })
    const store = new MemoryStore(root)
    await store.load()

    expect(validateMemory(store).map((issue) => issue.code)).toContain("gate-no-configurable")
  })
})

describe("validateMemory y el gate", () => {
  it("marca con severidad error una tarea done sin evidencia", async () => {
    const root = await makeMemoryRoot()
    const adr = await seedAdr(root)
    await writeTask(root, "tasks/task-f1-01-a.md", "TASK-F1-01", {
      status: "done",
      doc: adr,
      tests: { suite: "npm test", passed: true, evidence: null },
    })
    const store = new MemoryStore(root)
    await store.load()

    const issue = validateMemory(store).find((item) => item.code === "gate-evidencia")
    expect(issue?.severity).toBe("error")
  })
})
