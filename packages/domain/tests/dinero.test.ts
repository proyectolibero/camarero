/**
 * El subtotal de la cesta: suma de precio por cantidad en CLP enteros (CONTRACT-dinero).
 */
import { describe, expect, it } from "vitest"
import { subtotalDeLineas, totalDeLineas } from "../src/dinero.ts"

describe("Subtotal de lineas", () => {
  it("debe sumar precio por cantidad sin decimales", () => {
    expect(subtotalDeLineas([{ precioClp: 8900, cantidad: 2 }])).toBe(17800)
    expect(
      subtotalDeLineas([
        { precioClp: 8900, cantidad: 1 },
        { precioClp: 5000, cantidad: 3 },
      ]),
    ).toBe(23900)
  })

  it("debe devolver cero cuando no hay lineas", () => {
    expect(subtotalDeLineas([])).toBe(0)
  })

  it("debe respetar lineas a cero (un plato invitado) sin romper la suma", () => {
    expect(
      subtotalDeLineas([
        { precioClp: 0, cantidad: 2 },
        { precioClp: 1500, cantidad: 1 },
      ]),
    ).toBe(1500)
  })
})

describe("Total de lineas ya calculado por la base", () => {
  it("debe sumar los totales persistidos, incluidos los modificadores", () => {
    // El total que ve el comensal es la suma de line_total_clp, no un segundo calculo.
    expect(totalDeLineas([{ totalClp: 17800 }, { totalClp: 11800 }])).toBe(29600)
  })

  it("debe devolver cero sin lineas", () => {
    expect(totalDeLineas([])).toBe(0)
  })
})
