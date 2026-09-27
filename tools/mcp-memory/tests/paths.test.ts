import path from "node:path"
import { describe, expect, it } from "vitest"
import { docPath, PathEscapeError, safeResolve, slugify, toRelative } from "../src/core/paths.ts"

const ROOT = path.resolve("C:/memoria-de-prueba/docs/memory")

describe("safeResolve", () => {
  it("acepta una ruta relativa normal dentro de la memoria", () => {
    const resolved = safeResolve("decisions/d-001-algo.md", ROOT)
    expect(resolved).toBe(path.resolve(ROOT, "decisions/d-001-algo.md"))
  })

  it("normaliza separadores de Windows", () => {
    const resolved = safeResolve("adr\\adr-0001-algo.md", ROOT)
    expect(resolved).toBe(path.resolve(ROOT, "adr/adr-0001-algo.md"))
  })

  it("rechaza el escape con ..", () => {
    expect(() => safeResolve("../secreto.md", ROOT)).toThrow(PathEscapeError)
    expect(() => safeResolve("../../../../etc/passwd", ROOT)).toThrow(PathEscapeError)
    expect(() => safeResolve("adr/../../fuera.md", ROOT)).toThrow(PathEscapeError)
  })

  it("rechaza rutas absolutas y unidades de disco", () => {
    expect(() => safeResolve("C:/Windows/system32/x.md", ROOT)).toThrow(PathEscapeError)
    expect(() => safeResolve("/etc/passwd", ROOT)).toThrow(PathEscapeError)
  })

  it("rechaza la cadena vacia", () => {
    expect(() => safeResolve("", ROOT)).toThrow(PathEscapeError)
    expect(() => safeResolve("   ", ROOT)).toThrow(PathEscapeError)
  })

  it("no se deja enganar por un directorio hermano con prefijo comun", () => {
    // 'memory-otra' comparte prefijo textual con 'memory' si no se compara por ruta
    expect(() => safeResolve("../memory-otra/x.md", ROOT)).toThrow(PathEscapeError)
  })
})

describe("toRelative", () => {
  it("devuelve siempre separador /", () => {
    const absolute = path.resolve(ROOT, "risks", "risk-001-algo.md")
    expect(toRelative(absolute, ROOT)).toBe("risks/risk-001-algo.md")
  })
})

describe("slugify", () => {
  it("quita acentos, espacios y mayusculas", () => {
    expect(slugify("Emparejamiento de mesa con aprobación")).toBe(
      "emparejamiento-de-mesa-con-aprobacion",
    )
  })

  it("colapsa separadores repetidos y recorta los extremos", () => {
    expect(slugify("  Hola --- Mundo  ")).toBe("hola-mundo")
  })

  it("devuelve un valor por defecto si no queda nada util", () => {
    expect(slugify("###")).toBe("sin-titulo")
    expect(slugify("")).toBe("sin-titulo")
  })

  it("respeta la longitud maxima", () => {
    expect(slugify("a".repeat(200), 10)).toHaveLength(10)
  })
})

describe("docPath", () => {
  it("construye la ruta con el id en minusculas", () => {
    expect(docPath("adr", "ADR-0001", "Stack tecnológico")).toBe(
      "adr/adr-0001-stack-tecnologico.md",
    )
  })

  it("coloca los singletons en la raiz con el nombre del tipo", () => {
    expect(docPath("overview", "overview", "Vista general")).toBe("overview.md")
  })
})
