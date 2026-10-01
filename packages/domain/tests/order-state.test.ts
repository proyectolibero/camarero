/**
 * La maquina de estados de la comanda: 100 % de cobertura obligatoria (CONTRACT-estados-comanda).
 *
 * Se recorren TODAS las combinaciones de origen y destino, no solo las permitidas: asi la
 * matriz queda fijada entera y una transicion anadida por descuido rompe el test.
 */
import { describe, expect, it } from "vitest"
import {
  ESTADOS_DE_COMANDA,
  type EstadoDeComanda,
  esEstadoDeComanda,
  estadosPermitidos,
  siguienteEstado,
  transicionPermitida,
} from "../src/order-state.ts"

const ESPERADAS: Readonly<Record<EstadoDeComanda, readonly EstadoDeComanda[]>> = {
  pendiente: ["aceptada", "anulada"],
  aceptada: ["preparando", "servida", "anulada"],
  preparando: ["lista", "anulada"],
  lista: ["servida", "anulada"],
  servida: ["cerrada", "anulada"],
  cerrada: [],
  anulada: [],
}

describe("Estados de la comanda", () => {
  it("debe reconocer los siete estados del contrato y rechazar cualquier otro", () => {
    for (const estado of ESTADOS_DE_COMANDA) {
      expect(esEstadoDeComanda(estado)).toBe(true)
    }
    expect(esEstadoDeComanda("pending")).toBe(false)
    expect(esEstadoDeComanda("")).toBe(false)
    expect(esEstadoDeComanda("ACEPTADA")).toBe(false)
  })

  it("debe declarar exactamente las transiciones del contrato, origen a origen", () => {
    for (const origen of ESTADOS_DE_COMANDA) {
      expect(estadosPermitidos(origen)).toEqual(ESPERADAS[origen])
    }
  })

  it("debe permitir solo las transiciones de la matriz y ninguna otra", () => {
    for (const desde of ESTADOS_DE_COMANDA) {
      for (const hacia of ESTADOS_DE_COMANDA) {
        const permitida = ESPERADAS[desde].includes(hacia)
        expect({ desde, hacia, permitida: transicionPermitida(desde, hacia) }).toEqual({
          desde,
          hacia,
          permitida,
        })
      }
    }
  })

  it("no debe retroceder ni salir de un estado terminal", () => {
    expect(transicionPermitida("aceptada", "pendiente")).toBe(false)
    expect(transicionPermitida("cerrada", "servida")).toBe(false)
    expect(transicionPermitida("anulada", "pendiente")).toBe(false)
    expect(estadosPermitidos("cerrada")).toEqual([])
    expect(estadosPermitidos("anulada")).toEqual([])
  })

  it("debe avanzar al siguiente estado natural y parar en los terminales", () => {
    expect(siguienteEstado("pendiente")).toBe("aceptada")
    expect(siguienteEstado("aceptada")).toBe("preparando")
    expect(siguienteEstado("preparando")).toBe("lista")
    expect(siguienteEstado("lista")).toBe("servida")
    expect(siguienteEstado("servida")).toBe("cerrada")
    expect(siguienteEstado("cerrada")).toBeNull()
    expect(siguienteEstado("anulada")).toBeNull()
  })

  it("debe permitir entregar una comanda aceptada sin preparar (atajo de D-055)", () => {
    // Una bebida que solo hay que entregar no pasa por preparando ni por lista.
    expect(transicionPermitida("aceptada", "servida")).toBe(true)
    expect(estadosPermitidos("aceptada")).toContain("servida")
    // El avance natural de una comanda aceptada sigue siendo preparar: el atajo no lo cambia.
    expect(siguienteEstado("aceptada")).toBe("preparando")
    // Sigue sin poder saltarse pasos hacia atras ni alcanzar cerrada sin cobro.
    expect(transicionPermitida("servida", "aceptada")).toBe(false)
    expect(transicionPermitida("aceptada", "cerrada")).toBe(false)
  })
})
