/**
 * Autenticacion de borde: verificacion del pasaporte y comprobacion del PIN.
 *
 * No hace falta Supabase para probar esto: el pasaporte se firma aqui mismo con el mismo
 * algoritmo, y el PIN se hashea y se comprueba en la propia prueba. El runtime de Workers no
 * se necesita porque todo son funciones puras sobre Web Crypto, que Node 22 ya trae.
 */
import { describe, expect, it } from "vitest"
import { aBytes, bytesABase64Url } from "../src/auth/base64.ts"
import { TokenInvalido, verificarTokenHs256 } from "../src/auth/jwt.ts"
import { hashearPin, verificarPin } from "../src/auth/pin.ts"

const SECRETO = "secreto-de-prueba-no-real"
const AHORA = 1_800_000_000

async function firmarHs256(
  reclamaciones: Record<string, unknown>,
  secreto: string,
  cabecera: Record<string, unknown> = { alg: "HS256", typ: "JWT" },
): Promise<string> {
  const cabeceraB64 = bytesABase64Url(aBytes(JSON.stringify(cabecera)))
  const cuerpoB64 = bytesABase64Url(aBytes(JSON.stringify(reclamaciones)))
  const clave = await crypto.subtle.importKey(
    "raw",
    aBytes(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const firma = await crypto.subtle.sign("HMAC", clave, aBytes(`${cabeceraB64}.${cuerpoB64}`))
  return `${cabeceraB64}.${cuerpoB64}.${bytesABase64Url(new Uint8Array(firma))}`
}

// ---------------------------------------------------------------------------
// El pasaporte
// ---------------------------------------------------------------------------

describe("Pasaporte de Supabase: verificacion HS256", () => {
  it("debe devolver el sub cuando el token es valido", async () => {
    const token = await firmarHs256(
      { sub: "usuario-1", exp: AHORA + 3600, aud: "authenticated" },
      SECRETO,
    )
    const reclamaciones = await verificarTokenHs256(token, SECRETO, AHORA)
    expect(reclamaciones.sub).toBe("usuario-1")
    expect(reclamaciones.aud).toBe("authenticated")
  })

  it("debe rechazar un token caducado", async () => {
    const token = await firmarHs256({ sub: "usuario-1", exp: AHORA - 1 }, SECRETO)
    await expect(verificarTokenHs256(token, SECRETO, AHORA)).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token firmado con otro secreto", async () => {
    const token = await firmarHs256({ sub: "usuario-1", exp: AHORA + 3600 }, "otro-secreto")
    await expect(verificarTokenHs256(token, SECRETO, AHORA)).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token sin firma o con algoritmo distinto", async () => {
    const sinFirma = await firmarHs256({ sub: "usuario-1", exp: AHORA + 3600 }, SECRETO, {
      alg: "none",
      typ: "JWT",
    })
    await expect(verificarTokenHs256(sinFirma, SECRETO, AHORA)).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token mal formado", async () => {
    await expect(verificarTokenHs256("no-es-un-token", SECRETO, AHORA)).rejects.toThrow(
      TokenInvalido,
    )
  })

  it("debe rechazar un token sin sub", async () => {
    const token = await firmarHs256({ exp: AHORA + 3600 }, SECRETO)
    await expect(verificarTokenHs256(token, SECRETO, AHORA)).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token que no caduca", async () => {
    // Un token eterno es un token que nunca deja de valer si se filtra.
    const token = await firmarHs256({ sub: "usuario-1" }, SECRETO)
    await expect(verificarTokenHs256(token, SECRETO, AHORA)).rejects.toThrow(TokenInvalido)
  })
})

// ---------------------------------------------------------------------------
// El PIN
// ---------------------------------------------------------------------------

const ITERACIONES_RAPIDAS = 1000

describe("PIN de dispositivo: hash y comprobacion", () => {
  it("debe aceptar el PIN correcto", async () => {
    const hash = await hashearPin("4821", ITERACIONES_RAPIDAS)
    expect(await verificarPin("4821", hash)).toBe(true)
  })

  it("debe rechazar un PIN distinto", async () => {
    const hash = await hashearPin("4821", ITERACIONES_RAPIDAS)
    expect(await verificarPin("4822", hash)).toBe(false)
  })

  it("no debe guardar el PIN en claro", async () => {
    const hash = await hashearPin("4821", ITERACIONES_RAPIDAS)
    expect(hash).not.toContain("4821")
    expect(hash.startsWith("pbkdf2-sha256$")).toBe(true)
  })

  it("debe dar hashes distintos para el mismo PIN (sal aleatoria)", async () => {
    const primero = await hashearPin("4821", ITERACIONES_RAPIDAS)
    const segundo = await hashearPin("4821", ITERACIONES_RAPIDAS)
    expect(primero).not.toBe(segundo)
  })

  it("debe tratar un hash corrupto como no valido, sin reventar", async () => {
    expect(await verificarPin("4821", "basura")).toBe(false)
    expect(await verificarPin("4821", "pbkdf2-sha256$0$$")).toBe(false)
    expect(await verificarPin("4821", "otro-algoritmo$1000$aaaa$bbbb")).toBe(false)
  })
})
