/**
 * Apoyo comun de las pruebas del panel: firma de pasaportes y construccion de peticiones.
 *
 * Las claves se generan en cada prueba y no se toca la red: el manejador del borde recibe
 * la fuente de claves inyectada. El contexto de la base tambien se inyecta (un almacen
 * falso), de modo que ninguna prueba de rutas necesita Postgres.
 */
import { aBytes, bytesABase64Url } from "../src/auth/base64.ts"
import type { ClaveDeFirma } from "../src/auth/jwks.ts"

export const AHORA = new Date("2026-09-30T12:00:00.000Z")
export const KID = "clave-de-prueba"
export const ENTORNO = {
  SUPABASE_URL: "https://proyecto.test",
  DOMINIO_PUBLICO: "https://camarero.proyectolibero.org",
  BASE: { connectionString: "postgres://no-se-usa-en-las-pruebas" },
}

export type Firmante = {
  readonly clave: ClaveDeFirma
  readonly tokenPara: (sub: string) => Promise<string>
}

export async function crearFirmante(): Promise<Firmante> {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])
  const clave: ClaveDeFirma = {
    kid: KID,
    alg: "ES256",
    jwk: await crypto.subtle.exportKey("jwk", par.publicKey),
  }
  async function tokenPara(sub: string): Promise<string> {
    const cabecera = bytesABase64Url(aBytes(JSON.stringify({ alg: "ES256", typ: "JWT", kid: KID })))
    const exp = Math.floor(AHORA.getTime() / 1000) + 3600
    const cuerpo = bytesABase64Url(aBytes(JSON.stringify({ sub, exp })))
    const firma = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      par.privateKey,
      aBytes(`${cabecera}.${cuerpo}`),
    )
    return `${cabecera}.${cuerpo}.${bytesABase64Url(new Uint8Array(firma))}`
  }
  return { clave, tokenPara }
}

export type OpcionesPeticion = {
  readonly method?: string
  readonly cookie?: string
  readonly formulario?: Readonly<Record<string, string>>
}

export function peticion(ruta: string, opciones: OpcionesPeticion = {}): Request {
  const cabeceras = new Headers()
  if (opciones.cookie !== undefined) {
    cabeceras.set("cookie", `camarero_sesion=${opciones.cookie}`)
  }
  let cuerpo: string | undefined
  if (opciones.formulario !== undefined) {
    cabeceras.set("content-type", "application/x-www-form-urlencoded")
    cuerpo = new URLSearchParams(opciones.formulario).toString()
  }
  return new Request(`https://camarero.test${ruta}`, {
    method: opciones.method ?? "GET",
    headers: cabeceras,
    body: cuerpo,
  })
}
