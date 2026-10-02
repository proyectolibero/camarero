/**
 * La cuenta: descuento, propina y total (CONTRACT-dinero, D-039).
 *
 * Se prueban los casos borde que fija el contrato: descuento que no da entero, descuento
 * mayor que el subtotal, propina sobre el importe YA descontado y el redondeo por piso.
 */
import { describe, expect, it } from "vitest"
import { calcularCuenta, descuentoPorcentual, esPorcentajeDePropinaValido } from "../src/cuenta.ts"

describe("calcularCuenta", () => {
  it("debe devolver el subtotal sin descuento ni propina", () => {
    expect(calcularCuenta({ subtotalClp: 17800 })).toEqual({
      subtotalClp: 17800,
      descuentoClp: 0,
      importeClp: 17800,
      propinaClp: 0,
      totalClp: 17800,
    })
  })

  it("debe restar el descuento y calcular la propina sobre el importe descontado", () => {
    // 10.000 - 2.000 = 8.000; 10 % de 8.000 = 800; total 8.800.
    expect(calcularCuenta({ subtotalClp: 10000, descuentoClp: 2000, tipPercent: 10 })).toEqual({
      subtotalClp: 10000,
      descuentoClp: 2000,
      importeClp: 8000,
      propinaClp: 800,
      totalClp: 8800,
    })
  })

  it("no debe calcular la propina sobre el subtotal cuando hay descuento", () => {
    // Con 10 % sobre el subtotal la propina seria 1.000; sobre lo descontado es 800.
    const cuenta = calcularCuenta({ subtotalClp: 10000, descuentoClp: 2000, tipPercent: 10 })
    expect(cuenta.propinaClp).toBe(800)
    expect(cuenta.propinaClp).not.toBe(1000)
  })

  it("debe redondear la propina por piso", () => {
    // 10 % de 9.995 = 999,5 -> 999 (CONTRACT-dinero).
    expect(calcularCuenta({ subtotalClp: 9995, tipPercent: 10 }).propinaClp).toBe(999)
    // 5 % de 9.999 = 499,95 -> 499.
    expect(calcularCuenta({ subtotalClp: 9999, tipPercent: 5 }).propinaClp).toBe(499)
  })

  it("debe limitar el descuento al subtotal para no dejar el importe por debajo de cero", () => {
    const cuenta = calcularCuenta({ subtotalClp: 5000, descuentoClp: 9000, tipPercent: 10 })
    expect(cuenta.descuentoClp).toBe(5000)
    expect(cuenta.importeClp).toBe(0)
    expect(cuenta.propinaClp).toBe(0)
    expect(cuenta.totalClp).toBe(0)
  })

  it("debe tratar un subtotal o un descuento negativos como cero", () => {
    expect(calcularCuenta({ subtotalClp: -100, descuentoClp: -50 })).toEqual({
      subtotalClp: 0,
      descuentoClp: 0,
      importeClp: 0,
      propinaClp: 0,
      totalClp: 0,
    })
  })

  it("debe sumar exactamente importe y propina en el total", () => {
    const cuenta = calcularCuenta({ subtotalClp: 12345, descuentoClp: 345, tipPercent: 15 })
    expect(cuenta.totalClp).toBe(cuenta.importeClp + cuenta.propinaClp)
  })
})

describe("descuentoPorcentual", () => {
  it("debe redondear a entero por piso", () => {
    // 10 % de 9.990 = 999; 10 % de 9.995 = 999,5 -> 999 (CONTRACT-dinero).
    expect(descuentoPorcentual(9990, 10)).toBe(999)
    expect(descuentoPorcentual(9995, 10)).toBe(999)
  })

  it("no debe superar el subtotal cuando el porcentaje pasa del 100", () => {
    expect(descuentoPorcentual(5000, 150)).toBe(5000)
  })

  it("debe devolver cero sin porcentaje", () => {
    expect(descuentoPorcentual(10000, 0)).toBe(0)
    expect(descuentoPorcentual(10000, -5)).toBe(0)
  })
})

describe("esPorcentajeDePropinaValido", () => {
  it("debe aceptar solo los porcentajes del selector", () => {
    for (const valido of [0, 5, 10, 15, 20]) {
      expect(esPorcentajeDePropinaValido(valido)).toBe(true)
    }
  })

  it("no debe aceptar un porcentaje inventado", () => {
    expect(esPorcentajeDePropinaValido(7)).toBe(false)
    expect(esPorcentajeDePropinaValido(-5)).toBe(false)
    expect(esPorcentajeDePropinaValido(100)).toBe(false)
  })
})
