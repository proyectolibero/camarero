/**
 * Latido del borde: cron de keep-alive contra la pausa de Supabase Free (RISK-001).
 *
 * Se prueba el manejador sin tocar la red ni la base: los sondeos se inyectan. Lo que
 * importa es que un fallo no impida el otro sondeo, que el fallo quede registrado y que
 * el cron nunca se caiga.
 *
 * Ademas se prueba el sondeo REAL de la API con `fetch` interceptado: debe exigir un 2xx de
 * `/auth/v1/health`. Esta es la red de seguridad que impide recaer en LL-019 (un sondeo que
 * daba por bueno cualquier codigo, incluido el 401 que devolvia `/rest/v1/`).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { type DependenciasDeLatido, latido, llamarApi, manejarLatido } from "../src/keepalive.ts"

function recogedor(): { mensajes: string[]; registrar: (mensaje: string) => void } {
  const mensajes: string[] = []
  return {
    mensajes,
    registrar: (mensaje) => {
      mensajes.push(mensaje)
    },
  }
}

const SIN_FALLO = async (): Promise<void> => {}
const FALLA = async (): Promise<void> => {
  throw new Error("la base no responde")
}

describe("Latido: dos sondeos independientes", () => {
  it("debe marcar los dos como ok cuando ambos responden", async () => {
    const { mensajes, registrar } = recogedor()
    const dependencias: DependenciasDeLatido = {
      consultarBase: SIN_FALLO,
      llamarApi: SIN_FALLO,
      registrar,
    }

    const resultado = await latido(dependencias)

    expect(resultado).toEqual({ base: "ok", api: "ok" })
    expect(mensajes).toContain("keep-alive: base respondio")
    expect(mensajes).toContain("keep-alive: api respondio")
  })

  it("debe seguir con la API cuando la base falla, y registrar el fallo", async () => {
    const { mensajes, registrar } = recogedor()

    const resultado = await latido({ consultarBase: FALLA, llamarApi: SIN_FALLO, registrar })

    expect(resultado).toEqual({ base: "fallo", api: "ok" })
    expect(mensajes).toContain("keep-alive: api respondio")
    expect(
      mensajes.some((m) => m.includes("base fallo") && m.includes("la base no responde")),
    ).toBe(true)
  })

  it("debe seguir con la base cuando la API falla", async () => {
    const { registrar } = recogedor()

    const resultado = await latido({ consultarBase: SIN_FALLO, llamarApi: FALLA, registrar })

    expect(resultado).toEqual({ base: "ok", api: "fallo" })
  })

  it("no debe lanzar cuando fallan los dos, y debe registrar los dos fallos", async () => {
    const { mensajes, registrar } = recogedor()

    const resultado = await latido({ consultarBase: FALLA, llamarApi: FALLA, registrar })

    expect(resultado).toEqual({ base: "fallo", api: "fallo" })
    expect(mensajes.filter((m) => m.includes("fallo")).length).toBe(2)
  })
})

describe("Latido: construccion desde el entorno", () => {
  it("debe usar los sondeos inyectados cuando se aportan", async () => {
    let baseLlamada = false
    let apiLlamada = false
    const { registrar } = recogedor()

    await manejarLatido(
      {
        BASE: { connectionString: "sin-uso" },
        SUPABASE_URL: "https://x.test",
        SUPABASE_ANON_KEY: "k",
      },
      {
        registrar,
        consultarBase: async () => {
          baseLlamada = true
        },
        llamarApi: async () => {
          apiLlamada = true
        },
      },
    )

    expect(baseLlamada).toBe(true)
    expect(apiLlamada).toBe(true)
  })

  it("debe fallar con un motivo claro y sin lanzar cuando falta la configuracion", async () => {
    const { mensajes, registrar } = recogedor()

    const resultado = await manejarLatido({}, { registrar })

    expect(resultado).toEqual({ base: "fallo", api: "fallo" })
    expect(mensajes.some((m) => m.includes("BASE"))).toBe(true)
    expect(mensajes.some((m) => m.includes("SUPABASE_URL"))).toBe(true)
  })
})

describe("Sondeo de API: exige una respuesta concreta, no 'que responda'", () => {
  const URL_BASE = "https://proyecto.test"
  const CLAVE = "sb_publishable_de_prueba"

  function interceptar(codigo: number): { url: string; cabeceras: HeadersInit | undefined } {
    const capturado: { url: string; cabeceras: HeadersInit | undefined } = {
      url: "",
      cabeceras: undefined,
    }
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      capturado.url = url
      capturado.cabeceras = init?.headers
      return new Response("{}", { status: codigo })
    })
    return capturado
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("debe resolver cuando el endpoint responde 200", async () => {
    interceptar(200)

    await expect(llamarApi(URL_BASE, CLAVE)()).resolves.toBeUndefined()
  })

  it("debe sondear /auth/v1/health presentando la clave en la cabecera apikey", async () => {
    const capturado = interceptar(200)

    await llamarApi(URL_BASE, CLAVE)()

    expect(capturado.url).toBe(`${URL_BASE}/auth/v1/health`)
    expect(new Headers(capturado.cabeceras).get("apikey")).toBe(CLAVE)
  })

  it("debe rechazar y no dar por bueno el 401 que devolvia /rest/v1/ (LL-019)", async () => {
    interceptar(401)

    await expect(llamarApi(URL_BASE, CLAVE)()).rejects.toThrow("la API de salud respondio 401")
  })

  it("debe fallar si el sondeo vuelve a aceptar cualquier respuesta", async () => {
    for (const codigo of [301, 400, 403, 404, 500]) {
      interceptar(codigo)

      await expect(llamarApi(URL_BASE, CLAVE)()).rejects.toThrow(String(codigo))
    }
  })
})
