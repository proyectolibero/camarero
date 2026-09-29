/**
 * Enrutador del borde.
 *
 * Es una funcion pura: recibe la peticion, el entorno y la hora, y devuelve la respuesta. No
 * toca el runtime de Workers, asi que se puede probar con Vitest y Node a secas. El punto de
 * entrada del Worker (`index.ts`) solo le pasa un `new Date()`.
 */
import { responderMetodoNoPermitido, responderNoEncontrado, responderSalud } from "./salud.ts"

/** Variables y bindings del Worker. Se amplia cuando haya R2 y secretos. */
export type Entorno = {
  readonly VERSION?: string
}

const VERSION_POR_DEFECTO = "desconocida"

export function manejar(peticion: Request, entorno: Entorno, ahora: Date): Response {
  const url = new URL(peticion.url)

  if (url.pathname === "/health") {
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido()
    }
    return responderSalud(ahora, entorno.VERSION ?? VERSION_POR_DEFECTO)
  }

  return responderNoEncontrado()
}
