/**
 * El reparto por puesto: la decision de a que pantalla va cada comanda (ADR-0033, LL-025).
 *
 * Es la logica pura que comparten el borde y las pantallas: que un plato sin estacion vaya a
 * cocina, que la barra nazca aceptada y que la pantalla de cocina NO vea las bebidas.
 */
import { describe, expect, it } from "vitest"
import {
  destinoDeEstacion,
  destinosDelPuesto,
  esEstacionAutomatica,
  esPuestoDePantalla,
  etiquetaDeEstacion,
} from "../src/index.ts"

describe("Destino de una comanda", () => {
  it("debe copiar la estacion de la carta", () => {
    expect(destinoDeEstacion("frio")).toBe("frio")
    expect(destinoDeEstacion("bar")).toBe("bar")
  })

  it("debe mandar a cocina un plato sin estacion cuando la estacion es nula o vacia", () => {
    expect(destinoDeEstacion(null)).toBe("cocina")
    expect(destinoDeEstacion("")).toBe("cocina")
  })
})

describe("Puestos que nacen aceptados", () => {
  it("debe aceptar solos la barra y las bebidas", () => {
    expect(esEstacionAutomatica("bar")).toBe(true)
    expect(esEstacionAutomatica("bebidas")).toBe(true)
  })

  it("no debe aceptar solos los puestos de cocina", () => {
    expect(esEstacionAutomatica("frio")).toBe(false)
    expect(esEstacionAutomatica("caliente")).toBe(false)
    expect(esEstacionAutomatica("postre")).toBe(false)
    expect(esEstacionAutomatica("cocina")).toBe(false)
    expect(esEstacionAutomatica(null)).toBe(false)
  })
})

describe("Destinos que ve cada pantalla", () => {
  it("la cocina no debe ver las bebidas", () => {
    const destinos = destinosDelPuesto("cocina")
    expect(destinos).not.toBeNull()
    expect(destinos).toContain("frio")
    expect(destinos).toContain("caliente")
    expect(destinos).toContain("postre")
    expect(destinos).toContain("cocina")
    expect(destinos).not.toContain("bar")
    expect(destinos).not.toContain("bebidas")
  })

  it("la barra solo debe ver barra y bebidas", () => {
    expect([...(destinosDelPuesto("barra") ?? [])].sort()).toEqual(["bar", "bebidas"])
  })

  it("el todo no debe filtrar", () => {
    expect(destinosDelPuesto("todo")).toBeNull()
  })

  it("debe reconocer solo los tres puestos", () => {
    expect(esPuestoDePantalla("cocina")).toBe(true)
    expect(esPuestoDePantalla("barra")).toBe(true)
    expect(esPuestoDePantalla("todo")).toBe(true)
    expect(esPuestoDePantalla("parrilla")).toBe(false)
  })

  it("debe dar un nombre legible a cada destino", () => {
    expect(etiquetaDeEstacion("frio")).toBe("Frío")
    expect(etiquetaDeEstacion("bebidas")).toBe("Bebidas")
    expect(etiquetaDeEstacion("cocina")).toBe("Cocina")
    expect(etiquetaDeEstacion("desconocido")).toBe("desconocido")
  })
})
