/**
 * Enrutador del borde.
 *
 * Recibe la peticion, el entorno (variables y enlaces) y la hora. Verifica el pasaporte de
 * Supabase contra sus claves publicas y, a traves de Hyperdrive, resuelve la ficha del
 * empleado. La hora se pasa como parametro para poder probar la caducidad sin depender del
 * reloj real, y la fuente de claves se inyecta para poder probar sin salir a la red.
 */
import {
  type ClaveDeFirma,
  cargarClavesDeFirma,
  IdentidadNoDisponible,
  verificarConClaves,
} from "./auth/jwks.ts"
import type { Reclamaciones } from "./auth/jwt.ts"
import { resolverSesion } from "./base.ts"
import {
  responderError,
  responderMetodoNoPermitido,
  responderNoEncontrado,
  responderSalud,
  respuestaJson,
} from "./salud.ts"

/** De donde salen las claves publicas con las que se valida el pasaporte. */
export type FuenteDeClaves = (urlDeSupabase: string, ahoraEnMs: number) => Promise<ClaveDeFirma[]>

/** Variables y enlaces del Worker. */
export type Entorno = {
  readonly VERSION?: string
  readonly SUPABASE_URL?: string
  readonly BASE?: { readonly connectionString: string }
}

const VERSION_POR_DEFECTO = "desconocida"

function tokenDelEncabezado(peticion: Request): string | null {
  const autorizacion = peticion.headers.get("authorization") ?? ""
  if (!autorizacion.startsWith("Bearer ")) {
    return null
  }
  return autorizacion.slice("Bearer ".length)
}

async function manejarSesion(
  peticion: Request,
  entorno: Entorno,
  ahora: Date,
  fuente: FuenteDeClaves,
): Promise<Response> {
  if (entorno.SUPABASE_URL === undefined || entorno.BASE === undefined) {
    return responderError(503, "servicio_no_configurado")
  }
  const token = tokenDelEncabezado(peticion)
  if (token === null) {
    return responderError(401, "falta_token")
  }
  let claves: readonly ClaveDeFirma[]
  try {
    claves = await fuente(entorno.SUPABASE_URL, ahora.getTime())
  } catch (error) {
    if (error instanceof IdentidadNoDisponible) {
      // No sabemos validar pasaportes ahora mismo. No es que este token sea malo: es que no
      // podemos juzgarlo, y eso no se le achaca a quien llama con un 401.
      return responderError(503, "identidad_no_disponible")
    }
    throw error
  }
  let reclamaciones: Reclamaciones
  try {
    reclamaciones = await verificarConClaves(token, claves, Math.floor(ahora.getTime() / 1000))
  } catch {
    // Caducado, firma invalida o mal formado: para quien llama es lo mismo, no entra.
    return responderError(401, "token_invalido")
  }
  const contexto = await resolverSesion(entorno.BASE.connectionString, reclamaciones.sub)
  if (contexto === null) {
    return responderError(403, "empleado_no_vinculado")
  }
  return respuestaJson({ estado: "ok", empleado: contexto }, 200)
}

export async function manejar(
  peticion: Request,
  entorno: Entorno,
  ahora: Date,
  fuente: FuenteDeClaves = cargarClavesDeFirma,
): Promise<Response> {
  const url = new URL(peticion.url)

  if (url.pathname === "/health") {
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido()
    }
    return responderSalud(ahora, entorno.VERSION ?? VERSION_POR_DEFECTO)
  }

  if (url.pathname === "/auth/sesion") {
    if (peticion.method !== "POST") {
      return responderMetodoNoPermitido()
    }
    return await manejarSesion(peticion, entorno, ahora, fuente)
  }

  return responderNoEncontrado()
}
