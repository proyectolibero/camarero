/**
 * Punto de entrada del Worker de Camarero.
 *
 * No tiene logica: delega en el enrutador, que es puro y testeable. Aqui solo se compone la
 * hora real, que es la unica dependencia del exterior que el enrutador no puede tener.
 */
import { type Entorno, manejar } from "./enrutador.ts"

export default {
  fetch(peticion: Request, entorno: Entorno): Response {
    return manejar(peticion, entorno, new Date())
  },
}
