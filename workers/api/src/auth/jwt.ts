/**
 * Verificacion del pasaporte (JWT) que emite Supabase Auth.
 *
 * El borde NO confia en el token por venir de Supabase: comprueba la firma con el secreto
 * del proveedor y las reclamaciones. Aqui solo vive la parte pura y comprobable; el borde
 * decide despues que hace con el `sub` (leer la fila de empleado y fijar el contexto).
 *
 * Se implementa HS256, que es el algoritmo simetrico clasico de Supabase. Si el proyecto
 * nuevo usa firma asimetrica (JWKS), se anade aqui su verificacion sin tocar lo demas.
 */
import { aBytes, base64UrlABytes } from "./base64.ts"

const ALGORITMO = "HS256"

export type Reclamaciones = {
  readonly sub: string
  readonly exp: number | null
  readonly aud: string | null
  readonly iss: string | null
}

export class TokenInvalido extends Error {}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function leerJson(segmento: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlABytes(segmento)))
  } catch {
    throw new TokenInvalido("el token no es JSON valido")
  }
}

function tresPartes(token: string): [string, string, string] {
  const partes = token.split(".")
  const [cabecera, cuerpo, firma] = partes
  if (
    partes.length !== 3 ||
    cabecera === undefined ||
    cuerpo === undefined ||
    firma === undefined
  ) {
    throw new TokenInvalido("el token no tiene la forma esperada")
  }
  return [cabecera, cuerpo, firma]
}

export async function verificarTokenHs256(
  token: string,
  secreto: string,
  ahoraEnSegundos: number,
): Promise<Reclamaciones> {
  const [cabeceraB64, cuerpoB64, firmaB64] = tresPartes(token)

  const cabecera = leerJson(cabeceraB64)
  if (!esObjeto(cabecera) || cabecera.alg !== ALGORITMO) {
    throw new TokenInvalido("algoritmo de firma no soportado")
  }

  const clave = await crypto.subtle.importKey(
    "raw",
    aBytes(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  const firmaValida = await crypto.subtle.verify(
    "HMAC",
    clave,
    base64UrlABytes(firmaB64),
    aBytes(`${cabeceraB64}.${cuerpoB64}`),
  )
  if (!firmaValida) {
    throw new TokenInvalido("la firma no es valida")
  }

  const reclamaciones = leerJson(cuerpoB64)
  if (!esObjeto(reclamaciones) || typeof reclamaciones.sub !== "string") {
    throw new TokenInvalido("el token no identifica a nadie")
  }

  const exp = typeof reclamaciones.exp === "number" ? reclamaciones.exp : null
  // Se exige caducidad: un token sin `exp` seria eterno, y este es justo el dato que el
  // proveedor pone para que deje de valer.
  if (exp === null) {
    throw new TokenInvalido("el token no caduca")
  }
  if (exp <= ahoraEnSegundos) {
    throw new TokenInvalido("el token ha caducado")
  }

  return {
    sub: reclamaciones.sub,
    exp,
    aud: typeof reclamaciones.aud === "string" ? reclamaciones.aud : null,
    iss: typeof reclamaciones.iss === "string" ? reclamaciones.iss : null,
  }
}
