/**
 * Piezas compartidas para verificar un pasaporte (JWT).
 *
 * Aqui NO se comprueba la firma: eso depende del algoritmo y vive en `jwks.ts`. Aqui solo se
 * desmonta el token y se revisan sus reclamaciones, que es comun a cualquier algoritmo.
 */
import { base64UrlABytes } from "./base64.ts"

/**
 * Algoritmos que sabemos verificar. Se limita a los asimetricos que publica el JWKS: aceptar
 * `none` o un algoritmo simetrico abriria la puerta a que el propio token elija su cerradura.
 */
export const ALGORITMOS_DE_FIRMA = new Set(["ES256", "RS256"])

export type Reclamaciones = {
  readonly sub: string
  readonly exp: number | null
  readonly aud: string | null
  readonly iss: string | null
}

export class TokenInvalido extends Error {}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

export function leerJson(segmento: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlABytes(segmento)))
  } catch {
    throw new TokenInvalido("el token no es JSON valido")
  }
}

export function tresPartes(token: string): [string, string, string] {
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

/**
 * Comprueba lo que el token afirma sobre si mismo.
 *
 * Se exige caducidad: un token sin `exp` seria eterno, y es justo el dato que el proveedor
 * pone para que deje de valer si se filtra.
 */
export function revisarReclamaciones(cuerpo: unknown, ahoraEnSegundos: number): Reclamaciones {
  if (!esObjeto(cuerpo) || typeof cuerpo.sub !== "string") {
    throw new TokenInvalido("el token no identifica a nadie")
  }
  const exp = typeof cuerpo.exp === "number" ? cuerpo.exp : null
  if (exp === null) {
    throw new TokenInvalido("el token no caduca")
  }
  if (exp <= ahoraEnSegundos) {
    throw new TokenInvalido("el token ha caducado")
  }
  return {
    sub: cuerpo.sub,
    exp,
    aud: typeof cuerpo.aud === "string" ? cuerpo.aud : null,
    iss: typeof cuerpo.iss === "string" ? cuerpo.iss : null,
  }
}
