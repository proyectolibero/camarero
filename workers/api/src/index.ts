/**
 * Punto de entrada del Worker de Camarero.
 *
 * No tiene logica: delega en el enrutador, que se puede probar sin el runtime de Workers.
 * Aqui solo se compone la hora real, que es la unica dependencia del exterior que el
 * enrutador no puede tener.
 */
import { type Entorno, manejar } from "./enrutador.ts"
import { manejarLatido } from "./keepalive.ts"
import { manejarMantenimiento } from "./mantenimiento.ts"

export default {
  async fetch(peticion: Request, entorno: Entorno): Promise<Response> {
    return await manejar(peticion, entorno, new Date())
  },
  /**
   * Cron diario (`triggers.crons` en `wrangler.jsonc`). Mantiene viva la base de Supabase
   * frente a la pausa por inactividad (RISK-001, ADR-0026). El evento programado no se usa:
   * el latido no depende de la hora.
   */
  async scheduled(_evento: unknown, entorno: Entorno): Promise<void> {
    await manejarLatido(entorno)
    await manejarMantenimiento(entorno)
  },
}
