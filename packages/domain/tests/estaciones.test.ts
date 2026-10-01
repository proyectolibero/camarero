/**
 * Los puestos del local: la logica pura que comparten borde, panel y pantallas (ADR-0034).
 *
 * Los puestos ya no son cinco valores fijos: son datos del local. Aqui se prueba lo unico
 * que queda como logica pura: reconocer la pantalla "todo" y poner nombre a un puesto de una
 * lista. La regla de herencia (plato -> categoria -> defecto) NO vive aqui: su unica fuente
 * de verdad es la base (`camarero_estacion_de_plato`), que la aplica en una sola consulta y
 * la vuelve a comprobar con su disparador (H4).
 */
import { describe, expect, it } from "vitest"
import { esPantallaTodos, nombreDePuesto, type PuestoDelLocal } from "../src/index.ts"

const PUESTOS: readonly PuestoDelLocal[] = [
  { id: "p-cocina", nombre: "Cocina", orden: 0, activo: true, autoAcepta: false, porDefecto: true },
  { id: "p-barra", nombre: "Barra", orden: 4, activo: true, autoAcepta: true, porDefecto: false },
]

describe("Pantalla que muestra todo junto", () => {
  it("debe reconocer la pantalla todo", () => {
    expect(esPantallaTodos("todo")).toBe(true)
  })

  it("no debe confundir el id de un puesto con la pantalla todo", () => {
    expect(esPantallaTodos("p-cocina")).toBe(false)
  })

  it("no debe aceptar una cadena vacia como la pantalla todo", () => {
    expect(esPantallaTodos("")).toBe(false)
  })
})

describe("Nombre de un puesto", () => {
  it("debe dar el nombre del puesto de la lista", () => {
    expect(nombreDePuesto(PUESTOS, "p-barra")).toBe("Barra")
  })

  it("debe devolver null si no hay puesto, nunca inventar un nombre", () => {
    expect(nombreDePuesto(PUESTOS, null)).toBeNull()
    expect(nombreDePuesto(PUESTOS, "p-desconocido")).toBeNull()
  })

  it("debe seguir nombrando un puesto desactivado: la historia no se reescribe", () => {
    const retirado: readonly PuestoDelLocal[] = [
      {
        id: "p-viejo",
        nombre: "Plancha",
        orden: 9,
        activo: false,
        autoAcepta: false,
        porDefecto: false,
      },
    ]
    expect(nombreDePuesto(retirado, "p-viejo")).toBe("Plancha")
  })
})
