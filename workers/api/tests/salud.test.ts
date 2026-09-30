/**
 * Rutas del borde: salud y inicio de sesion.
 *
 * Se prueban las funciones del enrutador, que es lo unico que puede fallar por logica. La
 * conexion real a la base no se prueba aqui: eso es la comprobacion de aislamiento contra el
 * Supabase de verdad, que vive en el workflow "Instalar esquema".
 */
import { describe, expect, it } from "vitest"
import { manejar } from "../src/enrutador.ts"
import { construirSalud } from "../src/salud.ts"

const AHORA = new Date("2026-09-28T12:00:00.000Z")

function peticion(ruta: string, metodo = "GET", cabeceras?: Record<string, string>): Request {
  return new Request(`https://camarero.test${ruta}`, { method: metodo, headers: cabeceras })
}

describe("Borde: /health", () => {
  it("debe responder 200 con estado ok cuando se pide la salud", async () => {
    const respuesta = await manejar(peticion("/health"), { VERSION: "1.2.3" }, AHORA)

    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get("content-type")).toContain("application/json")
    // La salud nunca se cachea, o dejaria de detectar una caida.
    expect(respuesta.headers.get("cache-control")).toBe("no-store")

    const cuerpo: unknown = await respuesta.json()
    expect(cuerpo).toEqual(construirSalud(AHORA, "1.2.3"))
  })

  it("debe responder una version por defecto cuando el entorno no la trae", async () => {
    const respuesta = await manejar(peticion("/health"), {}, AHORA)
    const cuerpo = (await respuesta.json()) as { version: string }
    expect(cuerpo.version).toBe("desconocida")
  })

  it("debe incluir las cabeceras de seguridad", async () => {
    const respuesta = await manejar(peticion("/health"), {}, AHORA)

    expect(respuesta.headers.get("x-content-type-options")).toBe("nosniff")
    expect(respuesta.headers.get("referrer-policy")).toBe("no-referrer")
    expect(respuesta.headers.get("strict-transport-security")).toContain("max-age=")
    expect(respuesta.headers.get("content-security-policy")).toContain("default-src 'none'")
  })

  it("debe responder 404 cuando la ruta no existe", async () => {
    const respuesta = await manejar(peticion("/no-existe"), {}, AHORA)
    expect(respuesta.status).toBe(404)
  })

  it("debe responder 405 cuando el metodo no es GET", async () => {
    const respuesta = await manejar(peticion("/health", "POST"), {}, AHORA)
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("GET")
  })
})

describe("Borde: /auth/sesion", () => {
  it("debe responder 503 cuando el borde no tiene configurado el acceso", async () => {
    const respuesta = await manejar(peticion("/auth/sesion", "POST"), {}, AHORA)
    expect(respuesta.status).toBe(503)
  })

  it("debe responder 401 cuando no se presenta pasaporte", async () => {
    const entorno = { SUPABASE_JWT_SECRET: "secreto", BASE: { connectionString: "sin-uso" } }
    const respuesta = await manejar(peticion("/auth/sesion", "POST"), entorno, AHORA)
    expect(respuesta.status).toBe(401)
    const cuerpo = (await respuesta.json()) as { error: string }
    expect(cuerpo.error).toBe("falta_token")
  })

  it("debe responder 401 cuando el pasaporte no es valido", async () => {
    const entorno = { SUPABASE_JWT_SECRET: "secreto", BASE: { connectionString: "sin-uso" } }
    const respuesta = await manejar(
      peticion("/auth/sesion", "POST", { authorization: "Bearer no-es-un-token" }),
      entorno,
      AHORA,
    )
    expect(respuesta.status).toBe(401)
    const cuerpo = (await respuesta.json()) as { error: string }
    expect(cuerpo.error).toBe("token_invalido")
  })

  it("debe responder 405 cuando se usa GET en lugar de POST", async () => {
    const respuesta = await manejar(peticion("/auth/sesion"), {}, AHORA)
    expect(respuesta.status).toBe(405)
  })
})
