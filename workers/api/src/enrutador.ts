/**
 * Enrutador del borde.
 *
 * Recibe la peticion, el entorno (variables y enlaces) y la hora. Verifica el pasaporte de
 * Supabase y, a traves de Hyperdrive, resuelve la ficha del empleado. La hora se pasa como
 * parametro para poder probar la caducidad de los tokens sin depender del reloj real.
 */
import type { Reclamaciones } from "./auth/jwt.ts"
import { verificarTokenHs256 } from "./auth/jwt.ts"
import { resolverSesion } from "./base.ts"
import {
  responderError,
  responderMetodoNoPermitido,
  responderNoEncontrado,
  responderSalud,
  respuestaJson,
} from "./salud.ts"

/** Variables y enlaces del Worker. */
export type Entorno = {
  readonly VERSION?: string
  readonly SUPABASE_JWT_SECRET?: string
  readonly BASE?: { readonly connectionString: string }
}

const VERSION_POR_DEFECTO = "desconocida"

async function verificarORechazar(
  token: string,
  secreto: string,
  ahora: Date,
): Promise<Reclamaciones | null> {
  try {
    return await verificarTokenHs256(token, secreto, Math.floor(ahora.getTime() / 1000))
  } catch {
    // Token caducado, firma invalida o mal formado: para quien llama es lo mismo, no entra.
    return null
  }
}

async function manejarSesion(peticion: Request, entorno: Entorno, ahora: Date): Promise<Response> {
  if (entorno.SUPABASE_JWT_SECRET === undefined || entorno.BASE === undefined) {
    return responderError(503, "servicio_no_configurado")
  }
  const autorizacion = peticion.headers.get("authorization") ?? ""
  if (!autorizacion.startsWith("Bearer ")) {
    return responderError(401, "falta_token")
  }
  const reclamaciones = await verificarORechazar(
    autorizacion.slice("Bearer ".length),
    entorno.SUPABASE_JWT_SECRET,
    ahora,
  )
  if (reclamaciones === null) {
    return responderError(401, "token_invalido")
  }
  const contexto = await resolverSesion(entorno.BASE.connectionString, reclamaciones.sub)
  if (contexto === null) {
    return responderError(403, "empleado_no_vinculado")
  }
  return respuestaJson({ estado: "ok", empleado: contexto }, 200)
}

export async function manejar(peticion: Request, entorno: Entorno, ahora: Date): Promise<Response> {
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
    return await manejarSesion(peticion, entorno, ahora)
  }

  return responderNoEncontrado()
}
