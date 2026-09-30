/**
 * La sesion del personal: una cookie que el navegador no puede leer (ADR-0024).
 *
 * La cookie guarda el pasaporte de Supabase, no una sesion propia: su caducidad es la del
 * pasaporte. Aqui se lee, se verifica contra el JWKS publico (reutilizando `verificarConClaves`
 * y `cargarClavesDeFirma`) y se obtiene el `sub`, que la capa de base traduce a ficha.
 */
import { type ClaveDeFirma, type FuenteDeClaves, verificarConClaves } from "../auth/jwks.ts"

export const NOMBRE_COOKIE = "camarero_sesion"

type EntornoDeIdentidad = {
  readonly SUPABASE_URL?: string
}

/** Lee el valor de una cookie del encabezado `Cookie`. Devuelve null si no esta. */
export function leerCookie(peticion: Request, nombre: string): string | null {
  const encabezado = peticion.headers.get("cookie")
  if (encabezado === null) {
    return null
  }
  for (const trozo of encabezado.split(";")) {
    const [clave, ...resto] = trozo.trim().split("=")
    if (clave === nombre) {
      return resto.join("=")
    }
  }
  return null
}

/** Banderas obligatorias de la cookie de sesion. Es la unica via de escribirla. */
export function cookieDeSesion(token: string, maxAgeSegundos: number): string {
  const segundos = Math.max(0, Math.floor(maxAgeSegundos))
  return [
    `${NOMBRE_COOKIE}=${token}`,
    `Max-Age=${segundos}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ")
}

/** Borrar la cookie es escribirla vacia y con Max-Age=0. */
export function cookieDeBorrado(): string {
  return cookieDeSesion("", 0)
}

/**
 * Devuelve el `sub` del pasaporte de la cookie, o null si no hay sesion.
 *
 * Se trata como "sin sesion" cualquier fallo al juzgar la cookie (manipulada, caducada o
 * claves no disponibles): para una pantalla de entrada, la distincion no aporta nada y no
 * conviene filtrar por que fallo. La cerradura de verdad no es esta: es la RLS, que decide
 * que filas ve el `sub` una vez resuelto.
 */
export async function subDeLaSesion(
  peticion: Request,
  entorno: EntornoDeIdentidad,
  ahora: Date,
  fuente: FuenteDeClaves,
): Promise<string | null> {
  const token = leerCookie(peticion, NOMBRE_COOKIE)
  if (token === null || entorno.SUPABASE_URL === undefined) {
    return null
  }
  try {
    const claves: readonly ClaveDeFirma[] = await fuente(entorno.SUPABASE_URL, ahora.getTime())
    const reclamaciones = await verificarConClaves(
      token,
      claves,
      Math.floor(ahora.getTime() / 1000),
    )
    return reclamaciones.sub
  } catch {
    // Cookie invalida, caducada, o claves no disponibles: no hay sesion.
    return null
  }
}
