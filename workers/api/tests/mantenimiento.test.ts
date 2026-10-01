/**
 * El mantenimiento del cron: marcar caducadas sin depender de que alguien mire.
 *
 * Se prueba el manejador con el sondeo inyectado: ninguna prueba toca la red ni la base. Lo que
 * importa es que un fallo se registre y NO tumbe el cron (mismo criterio que el latido).
 */
import { describe, expect, it, vi } from "vitest"
import { manejarMantenimiento } from "../src/mantenimiento.ts"

const ENTORNO = { BASE: { connectionString: "postgres://no-se-usa-en-las-pruebas" } }

describe("Mantenimiento: caducar solicitudes", () => {
  it("debe marcar las caducadas y registrarlo", async () => {
    const registrar = vi.fn()
    const marcadas = await manejarMantenimiento(ENTORNO, {
      expirar: async () => 3,
      registrar,
    })
    expect(marcadas).toBe(3)
    expect(registrar).toHaveBeenCalledWith(expect.stringContaining("3 solicitudes"))
  })

  it("no debe tumbar el cron si el mantenimiento falla, y debe registrarlo", async () => {
    const registrar = vi.fn()
    const marcadas = await manejarMantenimiento(ENTORNO, {
      expirar: async () => {
        throw new Error("la base no responde")
      },
      registrar,
    })
    expect(marcadas).toBe(-1)
    expect(registrar).toHaveBeenCalledWith(expect.stringContaining("la base no responde"))
  })

  it("debe fallar con un motivo claro si falta el enlace a la base", async () => {
    const registrar = vi.fn()
    const marcadas = await manejarMantenimiento({}, { registrar })
    expect(marcadas).toBe(-1)
    expect(registrar).toHaveBeenCalledWith(expect.stringContaining("falta el enlace BASE"))
  })
})
