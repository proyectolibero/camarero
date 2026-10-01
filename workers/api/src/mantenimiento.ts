/**
 * Mantenimiento del borde: marca como `expired` las solicitudes de emparejamiento caducadas.
 *
 * Hasta ahora el estado `expired` estaba declarado en el esquema y no lo escribia nadie: una
 * solicitud caducada se acumulaba como pendiente hasta que alguien miraba, y el estado era letra
 * muerta (ADR-0032). El cron diario la marca sin que nadie mire.
 *
 * El cron NO es un empleado: es mantenimiento de plataforma, sin entrada de usuario en este
 * camino. Por eso fija `app.role = platform_admin` dentro de una transaccion corta y llama a la
 * funcion de la base, que solo permite la transicion pending -> expired de ventanas ya vencidas
 * (`pairing_requests_expirar`). Nunca lanza: un cron que muere al primer tropiezo deja de cumplir
 * su funcion (mismo criterio que el latido, LL-019).
 */
import { Client } from "pg"

export type EntornoDeMantenimiento = {
  readonly BASE?: { readonly connectionString: string }
}

/** Marca las solicitudes caducadas en la base y devuelve cuantas. */
export async function expirarSolicitudes(cadena: string): Promise<number> {
  const cliente = new Client({ connectionString: cadena, connectionTimeoutMillis: 10_000 })
  await cliente.connect()
  try {
    await cliente.query("begin")
    await cliente.query("select set_config('app.role', 'platform_admin', true)")
    const resultado = await cliente.query<{ n: number }>(
      "select public.camarero_expirar_solicitudes() as n",
    )
    await cliente.query("commit")
    return resultado.rows[0]?.n ?? 0
  } catch (error) {
    await cliente.query("rollback").catch(() => undefined)
    throw error
  } finally {
    await cliente.end()
  }
}

export type DependenciasParcialesDeMantenimiento = {
  readonly expirar?: () => Promise<number>
  readonly registrar?: (mensaje: string) => void
}

/**
 * Punto de entrada del mantenimiento. Devuelve cuantas se marcaron, o -1 si fallo (un fallo se
 * registra, nunca tumba el cron).
 */
export async function manejarMantenimiento(
  entorno: EntornoDeMantenimiento,
  parciales: DependenciasParcialesDeMantenimiento = {},
): Promise<number> {
  const registrar = parciales.registrar ?? ((mensaje) => console.log(mensaje))
  const cadena = entorno.BASE?.connectionString
  const expirar =
    parciales.expirar ??
    (cadena === undefined
      ? async () => {
          throw new Error("falta el enlace BASE de Hyperdrive")
        }
      : () => expirarSolicitudes(cadena))
  try {
    const marcadas = await expirar()
    registrar(`mantenimiento: ${marcadas} solicitudes marcadas caducadas`)
    return marcadas
  } catch (error) {
    const descripcion = error instanceof Error ? error.message : String(error)
    registrar(`mantenimiento fallo: ${descripcion}`)
    return -1
  }
}
