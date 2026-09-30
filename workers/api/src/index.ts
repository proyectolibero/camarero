/**
 * Punto de entrada del Worker de Camarero.
 *
 * No tiene logica: delega en el enrutador, que se puede probar sin el runtime de Workers.
 * Aqui solo se compone la hora real, que es la unica dependencia del exterior que el
 * enrutador no puede tener.
 */
import { type Entorno, manejar } from "./enrutador.ts"

export default {
  async fetch(peticion: Request, entorno: Entorno): Promise<Response> {
    return await manejar(peticion, entorno, new Date())
  },
}
