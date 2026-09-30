/**
 * Resolucion de la sesion para las pantallas de gestion del panel.
 *
 * Reutiliza la cookie del armazon (`sesion.ts`): lee el pasaporte de la cookie, lo verifica
 * contra el JWKS publico y traduce el `sub` a la ficha del empleado. Vive aparte para que
 * `rutas.ts` y `admin.ts` compartan la misma resolucion sin importarse entre si.
 */
import type { Empleado } from "../base.ts"
import type { Dependencias } from "./proveedor.ts"
import { subDeLaSesion } from "./sesion.ts"

export type EntornoDePanel = {
  readonly SUPABASE_URL?: string
  readonly DOMINIO_PUBLICO?: string
}

/**
 * Empleado de la sesion, o null si no hay sesion valida.
 *
 * Un fallo al juzgar la cookie se trata como "sin sesion" (lo hace `subDeLaSesion`); la
 * resolucion de la ficha NO se silencia: si la base falla, el error sube en lugar de
 * disfrazarse de entrada.
 */
export async function resolverEmpleadoDeSesion(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Empleado | null> {
  const sub = await subDeLaSesion(peticion, entorno, ahora, dependencias.fuenteDeClaves)
  if (sub === null) {
    return null
  }
  return await dependencias.resolverEmpleado(sub)
}
