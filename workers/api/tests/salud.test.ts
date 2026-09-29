/**
 * Tests del borde: el endpoint de salud y las cabeceras de seguridad.
 *
 * Se prueban las funciones puras del enrutador, que es lo unico que puede fallar por logica.
 * El despliegue real se comprueba aparte, con una peticion al dominio (evidencia de cierre).
 */
import { describe, expect, it } from "vitest"
import { manejar } from "../src/enrutador.ts"
import { construirSalud } from "../src/salud.ts"

const AHORA = new Date("2026-09-28T12:00:00.000Z")

function peticion(ruta: string, metodo = "GET"): Request {
  return new Request(`https://camarero.test${ruta}`, { method: metodo })
}

describe("Borde: /health", () => {
  it("debe responder 200 con estado ok cuando se pide la salud", async () => {
    const respuesta = manejar(peticion("/health"), { VERSION: "1.2.3" }, AHORA)

    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get("content-type")).toContain("application/json")
    // La salud nunca se cachea, o dejaria de detectar una caida.
    expect(respuesta.headers.get("cache-control")).toBe("no-store")

    const cuerpo: unknown = await respuesta.json()
    expect(cuerpo).toEqual(construirSalud(AHORA, "1.2.3"))
  })

  it("debe responder una version por defecto cuando el entorno no la trae", async () => {
    const respuesta = manejar(peticion("/health"), {}, AHORA)
    const cuerpo = (await respuesta.json()) as { version: string }
    expect(cuerpo.version).toBe("desconocida")
  })

  it("debe incluir las cabeceras de seguridad", () => {
    const respuesta = manejar(peticion("/health"), {}, AHORA)

    expect(respuesta.headers.get("x-content-type-options")).toBe("nosniff")
    expect(respuesta.headers.get("referrer-policy")).toBe("no-referrer")
    expect(respuesta.headers.get("strict-transport-security")).toContain("max-age=")
    expect(respuesta.headers.get("content-security-policy")).toContain("default-src 'none'")
  })

  it("debe responder 404 cuando la ruta no existe", () => {
    const respuesta = manejar(peticion("/no-existe"), {}, AHORA)
    expect(respuesta.status).toBe(404)
  })

  it("debe responder 405 cuando el metodo no es GET", () => {
    const respuesta = manejar(peticion("/health", "POST"), {}, AHORA)
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("GET")
  })
})
