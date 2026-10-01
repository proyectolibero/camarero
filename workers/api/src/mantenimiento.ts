/**
 * Mantenimiento del borde: cierra lo que el tiempo deja atras.
 *
 * Dos tareas, ambas sin que nadie mire:
 *   - Marca `expired` las solicitudes de emparejamiento caducadas (ADR-0032).
 *   - Cierra las sesiones de mesa sin actividad desde hace cuatro horas (TASK-F1-10,
 *     CONTRACT-protocolo-mesa). Antes el estado `closed` no lo escribia nadie y una mesa se
 *     quedaba ocupada para siempre.
 *
 * El cron NO es un empleado: es mantenimiento de plataforma, sin entrada de usuario. Por eso
 * fija `app.role = platform_admin` dentro de una transaccion corta y llama a las funciones de
 * la base, que solo permiten las transiciones esperadas. Nunca lanza: un cron que muere al
 * primer tropiezo deja de cumplir su funcion (mismo criterio que el latido, LL-019).
 */
import { Client } from "pg"

export type EntornoDeMantenimiento = {
  readonly BASE?: { readonly connectionString: string }
}

/** Ejecuta una funcion de mantenimiento con contexto de plataforma. */
async function conPlataforma<T>(
  cadena: string,
  trabajo: (cliente: Client) => Promise<T>,
): Promise<T> {
  const cliente = new Client({ connectionString: cadena, connectionTimeoutMillis: 10_000 })
  await cliente.connect()
  try {
    await cliente.query("begin")
    await cliente.query("select set_config('app.role', 'platform_admin', true)")
    const valor = await trabajo(cliente)
    await cliente.query("commit")
    return valor
  } catch (error) {
    await cliente.query("rollback").catch(() => undefined)
    throw error
  } finally {
    await cliente.end()
  }
}

/** Marca las solicitudes caducadas en la base y devuelve cuantas. */
export async function expirarSolicitudes(cadena: string): Promise<number> {
  return await conPlataforma(cadena, async (cliente) => {
    const resultado = await cliente.query<{ n: number }>(
      "select public.camarero_expirar_solicitudes() as n",
    )
    return resultado.rows[0]?.n ?? 0
  })
}

/** Cierra las sesiones sin actividad desde hace cuatro horas y devuelve cuantas. */
export async function cerrarSesionesInactivas(cadena: string): Promise<number> {
  return await conPlataforma(cadena, async (cliente) => {
    const resultado = await cliente.query<{ n: number }>(
      "select public.camarero_cerrar_sesiones_inactivas() as n",
    )
    return resultado.rows[0]?.n ?? 0
  })
}

export type DependenciasParcialesDeMantenimiento = {
  readonly expirar?: () => Promise<number>
  readonly cerrar?: () => Promise<number>
  readonly registrar?: (mensaje: string) => void
}

/**
 * Punto de entrada del mantenimiento. Devuelve cuantas solicitudes se marcaron, o -1 si algo
 * fallo (un fallo se registra, nunca tumba el cron).
 */
export async function manejarMantenimiento(
  entorno: EntornoDeMantenimiento,
  parciales: DependenciasParcialesDeMantenimiento = {},
): Promise<number> {
  const registrar = parciales.registrar ?? ((mensaje) => console.log(mensaje))
  const cadena = entorno.BASE?.connectionString
  const sinBase = () => {
    throw new Error("falta el enlace BASE de Hyperdrive")
  }
  const expirar =
    parciales.expirar ??
    (cadena === undefined ? async () => sinBase() : () => expirarSolicitudes(cadena))
  const cerrar =
    parciales.cerrar ??
    (cadena === undefined ? async () => sinBase() : () => cerrarSesionesInactivas(cadena))
  try {
    const marcadas = await expirar()
    registrar(`mantenimiento: ${marcadas} solicitudes marcadas caducadas`)
    const cerradas = await cerrar()
    registrar(`mantenimiento: ${cerradas} sesiones cerradas por inactividad`)
    return marcadas
  } catch (error) {
    const descripcion = error instanceof Error ? error.message : String(error)
    registrar(`mantenimiento fallo: ${descripcion}`)
    return -1
  }
}
