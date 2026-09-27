import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { MAX_CONTENT_BYTES, redactForOutput, scanContent } from "../src/core/guards.ts"
import { PathEscapeError, safeResolve } from "../src/core/paths.ts"
import { MemoryStore } from "../src/core/store.ts"
import { validateMemory } from "../src/core/validate.ts"
import { writeDocument } from "../src/core/writer.ts"
import { makeMemoryRoot, writeRawDoc } from "./helpers.ts"

const ROOT = path.resolve("C:/memoria-de-prueba/docs/memory")

function createLink(target: string, linkPath: string): void {
  if (process.platform === "win32") {
    try {
      symlinkSync(target, linkPath, "junction")
      return
    } catch {
      execFileSync("cmd", ["/c", "mklink", "/J", linkPath, target], { stdio: "ignore" })
      return
    }
  }
  symlinkSync(target, linkPath, "dir")
}

/** Comprueba si el sistema permite crear enlaces; si no, el test de frontera se omite. */
function supportsLinks(): boolean {
  const probe = mkdtempSync(path.join(tmpdir(), "camarero-link-probe-"))
  const target = path.join(probe, "target")
  const link = path.join(probe, "link")
  try {
    mkdirSync(target, { recursive: true })
    createLink(target, link)
    return existsSync(link)
  } catch {
    return false
  } finally {
    rmSync(probe, { recursive: true, force: true })
  }
}

const LINK_SUPPORTED = supportsLinks()

function decisionData(): Record<string, unknown> {
  return {
    id: "D-001",
    type: "decision",
    title: "Sin pagos en la app",
    status: "accepted",
    date: "2026-09-27",
    tags: [],
  }
}

describe("redactForOutput", () => {
  it("enmascara un token y no deja el valor original", () => {
    const token = "ghp_012345678901234567890123456789012345"

    const output = redactForOutput(`Error al cargar el documento, token: ${token}`)

    expect(output).not.toContain(token)
    expect(output).toContain("ghp_")
    expect(output).toContain("*")
  })
})

describe("no filtrado de secretos en el informe", () => {
  it("no expone un token presente en un frontmatter roto", async () => {
    const root = await makeMemoryRoot()
    const token = "ghp_012345678901234567890123456789012345"
    const source = [
      "---",
      "id: D-001",
      "type: decision",
      "title: ok",
      "status: accepted",
      "date: 2026-09-27",
      "tags: [a, b",
      `owner: ${token}`,
      "---",
      "",
      "Cuerpo.",
      "",
    ].join("\n")
    await writeRawDoc(root, "decisions/d-001-roto.md", source)

    const store = new MemoryStore(root)
    await store.load()
    expect(store.getIssues().length).toBeGreaterThan(0)

    const issuesText = store
      .getIssues()
      .map((issue) => issue.message)
      .join("\n")
    const reportText = validateMemory(store)
      .map((issue) => `[${issue.code}] ${issue.message}`)
      .join("\n")

    expect(issuesText).not.toContain(token)
    expect(reportText).not.toContain(token)
  })
})

describe("safeResolve: rutas hostiles", () => {
  it("rechaza flujos NTFS, puntos/espacios finales, directorios y rutas absolutas", () => {
    const rejected = [
      "foo.md:ads",
      "foo.md.",
      ".",
      "adr/..",
      "/etc/passwd",
      "\\\\servidor\\recurso",
    ]

    for (const candidate of rejected) {
      expect(() => safeResolve(candidate, ROOT), candidate).toThrow(PathEscapeError)
    }
  })

  it("rechaza un nombre con espacio final", () => {
    expect(() => safeResolve("foo.md ", ROOT)).toThrow(PathEscapeError)
  })
})

describe("frontera real (enlaces)", () => {
  it.skipIf(!LINK_SUPPORTED)(
    "writeDocument rechaza escribir a traves de un enlace que sale de la memoria",
    async () => {
      const root = await makeMemoryRoot()
      const outside = mkdtempSync(path.join(tmpdir(), "camarero-fuera-"))
      const link = path.join(root, "escape")
      try {
        createLink(outside, link)

        await expect(
          writeDocument("escape/fuera.md", decisionData(), "Cuerpo.", root),
        ).rejects.toThrow(PathEscapeError)
        expect(existsSync(path.join(outside, "fuera.md"))).toBe(false)
      } finally {
        rmSync(root, { recursive: true, force: true })
        rmSync(outside, { recursive: true, force: true })
      }
    },
  )
})

describe("entradas hostiles al cargar", () => {
  it("no se desploma con un alias YAML recursivo", async () => {
    const root = await makeMemoryRoot()
    const source = [
      "---",
      "id: D-001",
      "type: decision",
      "title: Circular",
      "status: accepted",
      "date: 2026-09-27",
      "tags: []",
      "foo: &x",
      "  bar: *x",
      "---",
      "",
      "## Alternativas",
      "",
      "Algo.",
      "",
    ].join("\n")
    await writeRawDoc(root, "decisions/d-001-circular.md", source)

    const store = new MemoryStore(root)
    await store.load()

    expect(store.all()).toHaveLength(0)
    expect(store.getIssues()).toHaveLength(1)
    expect(validateMemory(store).map((issue) => issue.code)).toContain("documento-invalido")
  })

  it("reporta un fichero mayor que MAX_CONTENT_BYTES y no lo carga", async () => {
    const root = await makeMemoryRoot()
    await writeRawDoc(root, "grande.md", "x".repeat(MAX_CONTENT_BYTES + 16))

    const store = new MemoryStore(root)
    await store.load()

    expect(store.all()).toHaveLength(0)
    expect(store.getIssues()).toHaveLength(1)
    expect(store.getIssues()[0]?.message).toContain("por encima del maximo")
  })
})

describe("rendimiento del escaneo", () => {
  it("escanea 256 KB con muchas coincidencias en menos de un segundo", () => {
    const line = "key = AKIAIOSFODNN7EXAMPLE\n"
    const text = line.repeat(Math.ceil((256 * 1024) / line.length))

    const start = performance.now()
    const findings = scanContent(text)
    const elapsed = performance.now() - start

    expect(findings.length).toBeGreaterThan(1000)
    expect(elapsed).toBeLessThan(1000)
  })
})
