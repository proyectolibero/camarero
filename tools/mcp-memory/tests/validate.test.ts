import { describe, expect, it } from "vitest"
import { MemoryStore } from "../src/core/store.ts"
import type { ValidateIssue } from "../src/core/validate.ts"
import { validateMemory } from "../src/core/validate.ts"
import { buildDoc, makeMemoryRoot, writeRawDoc } from "./helpers.ts"

async function load(root: string): Promise<ValidateIssue[]> {
  const store = new MemoryStore(root)
  await store.load()
  return [...validateMemory(store)]
}

const codes = (issues: readonly ValidateIssue[]): string[] => issues.map((issue) => issue.code)

describe("validateMemory: integridad", () => {
  it("detecta dos documentos con el mismo identificador (id-duplicado)", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "decisions/d-001-primera.md",
      buildDoc({ id: "D-001", type: "decision", title: "Primera" }, "## Alternativas\n\nA."),
    )
    await writeRawDoc(
      root,
      "decisions/d-001-segunda.md",
      buildDoc({ id: "D-001", type: "decision", title: "Segunda" }, "## Alternativas\n\nB."),
    )

    expect(codes(await load(root))).toContain("id-duplicado")
  })

  it("detecta una referencia a un identificador inexistente (referencia-rota)", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "decisions/d-002-con-referencia.md",
      buildDoc(
        { id: "D-002", type: "decision", title: "Con referencia", related: ["D-999"] },
        "## Alternativas\n\nA.",
      ),
    )

    const issues = await load(root)
    const broken = issues.find((issue) => issue.code === "referencia-rota")
    expect(broken?.message).toContain("D-999")
  })

  it("detecta una decision aceptada sin seccion de alternativas", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "decisions/d-003-sin-alternativas.md",
      buildDoc(
        { id: "D-003", type: "decision", title: "Sin alternativas", status: "accepted" },
        "## Decision\n\nAlgo sin alternativas.",
      ),
    )

    const issue = (await load(root)).find((item) => item.code === "decision-sin-alternativas")
    expect(issue?.severity).toBe("error")
  })

  it("no marca referencia-rota cuando el campo doc apunta a una ruta existente", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "adr/adr-0001-stack.md",
      buildDoc({ id: "ADR-0001", type: "adr", title: "Stack" }, "## Alternativas\n\nOtra."),
    )
    await writeRawDoc(
      root,
      "tasks/task-f1-01-a.md",
      buildDoc(
        {
          id: "TASK-F1-01",
          type: "task",
          title: "Una tarea",
          extra: { doc: "adr/adr-0001-stack.md", acceptance: ["criterio verificable"] },
        },
        "## Descripcion\n\nAlgo.",
      ),
    )

    const issues = await load(root)
    expect(issues.filter((issue) => issue.code === "referencia-rota")).toHaveLength(0)
  })

  it("avisa cuando el nombre del fichero no empieza por su identificador", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "decisions/otro-nombre.md",
      buildDoc({ id: "D-004", type: "decision", title: "Mal nombrada" }, "## Alternativas\n\nA."),
    )

    const issue = (await load(root)).find((item) => item.code === "id-no-coincide-con-ruta")
    expect(issue?.severity).toBe("warning")
  })

  it("detecta dos documentos de un tipo singleton (singleton-duplicado)", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "overview.md",
      buildDoc({ id: "overview", type: "overview", title: "Vista general" }),
    )
    await writeRawDoc(
      root,
      "overview-vista-general.md",
      buildDoc({ id: "overview", type: "overview", title: "Vista general" }),
    )

    expect(codes(await load(root))).toContain("singleton-duplicado")
  })

  it("detecta un secreto escondido en el campo owner (no en el cuerpo)", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(
      root,
      "decisions/d-005-secreto.md",
      buildDoc(
        {
          id: "D-005",
          type: "decision",
          title: "Con secreto en owner",
          extra: { owner: "password: abcdef123456789" },
        },
        "## Alternativas\n\nA.",
      ),
    )

    const issue = (await load(root)).find((item) => item.code === "secreto-detectado")
    expect(issue?.severity).toBe("error")
  })
})
