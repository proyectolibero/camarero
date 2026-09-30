/**
 * Verificacion del pasaporte contra las claves publicas de Supabase (JWKS).
 *
 * Supabase firma con clave ASIMETRICA (ES256): publica la publica y se queda la privada. Es
 * mejor que un secreto compartido, porque el borde no guarda nada que, si se filtra, permita
 * fabricar pasaportes: solo la clave publica, que se puede leer sin riesgo.
 *
 * El algoritmo NO lo elige el token: se comprueba contra la lista blanca. Si el token dijera
 * `HS256` o `none`, se rechaza antes de mirar la firma.
 */
import { aBytes, base64UrlABytes } from "./base64.ts"
import {
  ALGORITMOS_DE_FIRMA,
  esObjeto,
  leerJson,
  type Reclamaciones,
  revisarReclamaciones,
  TokenInvalido,
  tresPartes,
} from "./jwt.ts"

const RUTA_JWKS = "/auth/v1/.well-known/jwks.json"
const UNA_HORA_EN_MS = 60 * 60 * 1000

export type ClaveDeFirma = {
  readonly kid: string
  readonly alg: string
  readonly jwk: JsonWebKey
}

/** De donde salen las claves publicas con las que se valida el pasaporte. */
export type FuenteDeClaves = (urlDeSupabase: string, ahoraEnMs: number) => Promise<ClaveDeFirma[]>

/** El borde no pudo averiguar con que claves validar: no es culpa de quien llama. */
export class IdentidadNoDisponible extends Error {}

/** Lee el JWKS y se queda solo con lo que sabemos verificar. */
export function interpretarJwks(cuerpo: unknown): ClaveDeFirma[] {
  if (!esObjeto(cuerpo) || !Array.isArray(cuerpo.keys)) {
    throw new TokenInvalido("el JWKS no trae claves")
  }
  const claves: ClaveDeFirma[] = []
  for (const entrada of cuerpo.keys) {
    if (!esObjeto(entrada)) {
      continue
    }
    const { kid, alg } = entrada
    if (typeof kid !== "string" || typeof alg !== "string" || !ALGORITMOS_DE_FIRMA.has(alg)) {
      continue
    }
    claves.push({ kid, alg, jwk: entrada as unknown as JsonWebKey })
  }
  if (claves.length === 0) {
    throw new TokenInvalido("el JWKS no trae ninguna clave verificable")
  }
  return claves
}

async function importarClave(jwk: JsonWebKey, alg: string): Promise<CryptoKey> {
  if (alg === "ES256") {
    return await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    )
  }
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  )
}

function parametrosDeVerificacion(alg: string): AlgorithmIdentifier | EcdsaParams {
  if (alg === "ES256") {
    return { name: "ECDSA", hash: "SHA-256" }
  }
  return { name: "RSASSA-PKCS1-v1_5" }
}

/**
 * Comprueba la firma con las claves publicas y devuelve las reclamaciones.
 *
 * Se prueban solo las claves que el `kid` de la cabecera senala; si el token no trae `kid`, se
 * prueban todas. Basta con que una clave valide la firma.
 */
export async function verificarConClaves(
  token: string,
  claves: readonly ClaveDeFirma[],
  ahoraEnSegundos: number,
): Promise<Reclamaciones> {
  const [cabeceraB64, cuerpoB64, firmaB64] = tresPartes(token)
  const cabecera = leerJson(cabeceraB64)
  if (!esObjeto(cabecera) || typeof cabecera.alg !== "string") {
    throw new TokenInvalido("el token no declara algoritmo")
  }
  if (!ALGORITMOS_DE_FIRMA.has(cabecera.alg)) {
    throw new TokenInvalido(`algoritmo de firma no soportado: ${cabecera.alg}`)
  }
  const kid = typeof cabecera.kid === "string" ? cabecera.kid : null
  const candidatas = claves.filter(
    (clave) => clave.alg === cabecera.alg && (kid === null || clave.kid === kid),
  )
  const mensaje = aBytes(`${cabeceraB64}.${cuerpoB64}`)
  const firma = base64UrlABytes(firmaB64)
  for (const candidata of candidatas) {
    const clave = await importarClave(candidata.jwk, candidata.alg)
    const valida = await crypto.subtle.verify(
      parametrosDeVerificacion(candidata.alg),
      clave,
      firma,
      mensaje,
    )
    if (valida) {
      return revisarReclamaciones(leerJson(cuerpoB64), ahoraEnSegundos)
    }
  }
  throw new TokenInvalido("ninguna clave publica valida esta firma")
}

let enCache: { claves: ClaveDeFirma[]; expiraEnMs: number } | null = null

/** Descarga el JWKS, con una cache corta en memoria del propio Worker. */
export async function cargarClavesDeFirma(
  urlDeSupabase: string,
  ahoraEnMs: number,
): Promise<ClaveDeFirma[]> {
  if (enCache !== null && enCache.expiraEnMs > ahoraEnMs) {
    return enCache.claves
  }
  const url = `${urlDeSupabase.replace(/\/+$/, "")}${RUTA_JWKS}`
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) {
      throw new IdentidadNoDisponible(`el JWKS respondio ${respuesta.status}`)
    }
    const claves = interpretarJwks(await respuesta.json())
    enCache = { claves, expiraEnMs: ahoraEnMs + UNA_HORA_EN_MS }
    return claves
  } catch (error) {
    // La causa original se conserva en el mensaje: sin ella, un error de red seria indistinguible
    // de un JWKS mal formado, y son dos averias muy distintas.
    if (error instanceof IdentidadNoDisponible) {
      throw error
    }
    throw new IdentidadNoDisponible(`no se pudo leer el JWKS: ${String(error)}`)
  }
}
