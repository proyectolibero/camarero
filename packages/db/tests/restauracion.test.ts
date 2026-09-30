/**
 * Comparacion de metricas del ensayo de restauracion (logica pura, sin base de datos).
 *
 * El contraste origen/restaurado es lo que decide si una copia vale. Si esta comparacion
 * no distingue una restauracion completa de una rota, el ensayo entero es decorativo.
 */
import { describe, expect, it } from "vitest"
import { compararMetricas, type MetricasDeRestauracion } from "../src/restauracion.ts"

const COMPLETAS: MetricasDeRestauracion = {
  tablasPublicas: 28,
  orgs: 3,
  locations: 2,
  staff: 4,
  authUsers: 1,
}

describe("compararMetricas", () => {
  it("debe dar ok cuando todas las metricas coinciden", () => {
    const resultado = compararMetricas(COMPLETAS, { ...COMPLETAS })

    expect(resultado.ok).toBe(true)
    expect(resultado.discrepancias).toBe(0)
    expect(resultado.lineas).toHaveLength(5)
    expect(resultado.lineas.every((linea) => linea.endsWith("OK"))).toBe(true)
  })

  it("debe senalar la discrepancia cuando falta una tabla y dejar el resto intacto", () => {
    const restaurada: MetricasDeRestauracion = { ...COMPLETAS, tablasPublicas: 27 }

    const resultado = compararMetricas(COMPLETAS, restaurada)

    expect(resultado.ok).toBe(false)
    expect(resultado.discrepancias).toBe(1)
    expect(resultado.lineas[0]).toContain("DIFERENTE")
  })

  it("debe contar todas las diferencias cuando la restauracion quedo vacia", () => {
    const vacia: MetricasDeRestauracion = {
      tablasPublicas: 0,
      orgs: 0,
      locations: 0,
      staff: 0,
      authUsers: 0,
    }

    const resultado = compararMetricas(COMPLETAS, vacia)

    expect(resultado.ok).toBe(false)
    expect(resultado.discrepancias).toBe(5)
  })

  it("debe dar ok con dos bases vacias: cero y cero tambien coinciden", () => {
    const vacia: MetricasDeRestauracion = {
      tablasPublicas: 0,
      orgs: 0,
      locations: 0,
      staff: 0,
      authUsers: 0,
    }

    const resultado = compararMetricas(vacia, vacia)

    expect(resultado.ok).toBe(true)
    expect(resultado.discrepancias).toBe(0)
  })
})
