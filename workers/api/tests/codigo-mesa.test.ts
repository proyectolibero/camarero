/**
 * Codigo de mesa: formato dictable por telefono y deteccion del choque unico.
 *
 * El alfabeto excluye `0`, `O`, `1` e `I` porque se confunden al oido. El patron tiene que
 * coincidir exactamente con el `check` `tables_code_formato` de la migracion 0002.
 */
import { describe, expect, it } from "vitest"
import {
  ALFABETO_MESA,
  esConflictoDeCodigo,
  generarCodigoMesa,
  LONGITUD_CODIGO_MESA,
  PATRON_CODIGO_MESA,
} from "../src/panel/codigo-mesa.ts"

describe("Codigo de mesa", () => {
  it("debe medir exactamente ocho caracteres", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generarCodigoMesa()).toHaveLength(LONGITUD_CODIGO_MESA)
    }
  })

  it("debe usar solo el alfabeto sin 0, O, 1 ni I", () => {
    for (let i = 0; i < 500; i += 1) {
      const codigo = generarCodigoMesa()
      expect(PATRON_CODIGO_MESA.test(codigo)).toBe(true)
      expect(codigo).not.toMatch(/[0O1I]/)
    }
  })

  it("debe llevar el alfabeto de la migracion, sin letras ambiguas", () => {
    expect(ALFABETO_MESA).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    expect(ALFABETO_MESA).not.toContain("0")
    expect(ALFABETO_MESA).not.toContain("O")
    expect(ALFABETO_MESA).not.toContain("1")
    expect(ALFABETO_MESA).not.toContain("I")
  })

  it("no debe repetir codigo en muchas generaciones seguidas", () => {
    const vistos = new Set<string>()
    for (let i = 0; i < 2000; i += 1) {
      vistos.add(generarCodigoMesa())
    }
    expect(vistos.size).toBe(2000)
  })
})

describe("Deteccion de choque de codigo", () => {
  it("debe reconocer el choque de la restriccion unica por local", () => {
    expect(esConflictoDeCodigo({ code: "23505", constraint: "tables_location_code_unico" })).toBe(
      true,
    )
  })

  it("no debe confundir otro 23505 de otra restriccion", () => {
    expect(esConflictoDeCodigo({ code: "23505", constraint: "zones_location_nombre_unico" })).toBe(
      false,
    )
  })

  it("no debe reconocer otros errores ni valores que no lo son", () => {
    expect(esConflictoDeCodigo({ code: "42501", constraint: "tables_location_code_unico" })).toBe(
      false,
    )
    expect(esConflictoDeCodigo(new Error("sin code"))).toBe(false)
    expect(esConflictoDeCodigo("23505")).toBe(false)
    expect(esConflictoDeCodigo(null)).toBe(false)
  })
})
