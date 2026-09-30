/**
 * Autenticacion de borde: verificacion del pasaporte y comprobacion del PIN.
 *
 * No hace falta Supabase para probar esto: se genera un par de claves asimetrico en la propia
 * prueba y se firma con el. El runtime de Workers no se necesita porque todo son funciones
 * puras sobre Web Crypto, que Node ya trae.
 */
import { describe, expect, it } from "vitest"
import { aBytes, bytesABase64Url } from "../src/auth/base64.ts"
import { interpretarJwks, verificarConClaves } from "../src/auth/jwks.ts"
import { TokenInvalido } from "../src/auth/jwt.ts"
import { hashearPin, verificarPin } from "../src/auth/pin.ts"

const AHORA = 1_800_000_000
const KID = "clave-de-prueba"

type ParDeClaves = { readonly privada: CryptoKey; readonly jwk: JsonWebKey }

async function generarParEs256(): Promise<ParDeClaves> {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])
  return { privada: par.privateKey, jwk: await crypto.subtle.exportKey("jwk", par.publicKey) }
}

async function firmarEs256(
  reclamaciones: Record<string, unknown>,
  privada: CryptoKey,
  cabecera: Record<string, unknown> = { alg: "ES256", typ: "JWT", kid: KID },
): Promise<string> {
  const cabeceraB64 = bytesABase64Url(aBytes(JSON.stringify(cabecera)))
  const cuerpoB64 = bytesABase64Url(aBytes(JSON.stringify(reclamaciones)))
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privada,
    aBytes(`${cabeceraB64}.${cuerpoB64}`),
  )
  return `${cabeceraB64}.${cuerpoB64}.${bytesABase64Url(new Uint8Array(firma))}`
}

// ---------------------------------------------------------------------------
// El pasaporte
// ---------------------------------------------------------------------------

describe("Pasaporte de Supabase: verificacion con claves publicas (ES256)", () => {
  it("debe devolver el sub cuando el token es valido", async () => {
    const { privada, jwk } = await generarParEs256()
    const token = await firmarEs256(
      { sub: "usuario-1", exp: AHORA + 3600, aud: "authenticated" },
      privada,
    )

    const reclamaciones = await verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk }], AHORA)

    expect(reclamaciones.sub).toBe("usuario-1")
    expect(reclamaciones.aud).toBe("authenticated")
  })

  it("debe rechazar un token caducado", async () => {
    const { privada, jwk } = await generarParEs256()
    const token = await firmarEs256({ sub: "usuario-1", exp: AHORA - 1 }, privada)
    await expect(
      verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token firmado con otra clave privada", async () => {
    // Es el ataque que importa: alguien fabrica un pasaporte, pero no tiene la clave privada
    // de Supabase. La clave publica no le sirve para firmar.
    const suplantador = await generarParEs256()
    const legitimo = await generarParEs256()
    const token = await firmarEs256({ sub: "usuario-1", exp: AHORA + 3600 }, suplantador.privada)

    await expect(
      verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk: legitimo.jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token que se declara simetrico (HS256)", async () => {
    // Sin esta cerradura, quien firma elegiria el algoritmo: el viejo truco de pedir `none`
    // o un algoritmo simetrico para colarse.
    const { privada, jwk } = await generarParEs256()
    const token = await firmarEs256({ sub: "usuario-1", exp: AHORA + 3600 }, privada, {
      alg: "HS256",
      typ: "JWT",
      kid: KID,
    })

    await expect(
      verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token cuyo kid no corresponde a ninguna clave", async () => {
    const { privada, jwk } = await generarParEs256()
    const token = await firmarEs256({ sub: "usuario-1", exp: AHORA + 3600 }, privada, {
      alg: "ES256",
      typ: "JWT",
      kid: "otra-clave",
    })

    await expect(
      verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token mal formado", async () => {
    const { jwk } = await generarParEs256()
    await expect(
      verificarConClaves("no-es-un-token", [{ kid: KID, alg: "ES256", jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token sin sub", async () => {
    const { privada, jwk } = await generarParEs256()
    const token = await firmarEs256({ exp: AHORA + 3600 }, privada)
    await expect(
      verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })

  it("debe rechazar un token que no caduca", async () => {
    const { privada, jwk } = await generarParEs256()
    const token = await firmarEs256({ sub: "usuario-1" }, privada)
    await expect(
      verificarConClaves(token, [{ kid: KID, alg: "ES256", jwk }], AHORA),
    ).rejects.toThrow(TokenInvalido)
  })
})

describe("JWKS de Supabase: lectura de claves publicas", () => {
  it("debe quedarse con las claves verificables y descartar el resto", () => {
    const claves = interpretarJwks({
      keys: [
        { kid: "a", alg: "ES256", kty: "EC", crv: "P-256", x: "x", y: "y" },
        { kid: "b", alg: "HS256", kty: "oct", k: "secreto" },
        { alg: "ES256" },
        "no-soy-un-objeto",
      ],
    })

    expect(claves).toHaveLength(1)
    expect(claves[0]?.kid).toBe("a")
  })

  it("debe fallar cuando el JWKS no trae ninguna clave utilizable", () => {
    expect(() => interpretarJwks({ keys: [] })).toThrow(TokenInvalido)
    expect(() => interpretarJwks({})).toThrow(TokenInvalido)
    expect(() => interpretarJwks(null)).toThrow(TokenInvalido)
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
