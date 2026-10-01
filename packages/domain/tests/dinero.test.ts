/**
 * El subtotal de la cesta: suma de precio por cantidad en CLP enteros (CONTRACT-dinero).
 */
import { describe, expect, it } from "vitest"
import { subtotalDeLineas } from "../src/dinero.ts"

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
