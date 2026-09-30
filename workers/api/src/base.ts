/**
 * Acceso del borde a la base de datos, a traves de Hyperdrive.
 *
 * El borde es la unica puerta: fija el contexto de identidad (`app.*`) dentro de una
 * transaccion corta y consulta. La transaccion es obligatoria: con el pool de Hyperdrive, un
 * contexto fijado a nivel de sesion podria filtrarse a la peticion siguiente.
 *
 * Aqui NO se resuelve el pasaporte: eso se hace antes, verificando la firma. Esta capa recibe
 * ya el identificador de usuario de confianza.
 */
import { Client } from "pg"

export type Contexto = {
  readonly staffId: string
  readonly orgId: string
  readonly locationId: string | null
  readonly role: string
}

type FilaStaff = {
  readonly id: string
  readonly org_id: string
  readonly location_id: string | null
  readonly role: string
}

/**
 * Busca la ficha de empleado vinculada al usuario de Supabase Auth.
 *
 * Se fija la reclamacion del token en la transaccion para que la cerradura minima de `staff`
 * (la que deja leer la propia fila) permita verla. Sin contexto, esa politica devuelve cero
 * filas: el aislamiento no se relaja en ningun momento.
 */
export async function resolverSesion(
  cadenaConexion: string,
  usuarioDeAuth: string,
): Promise<Contexto | null> {
  const cliente = new Client({ connectionString: cadenaConexion })
  await cliente.connect()
  try {
    await cliente.query("begin")
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: usuarioDeAuth }),
    ])
    const resultado = await cliente.query<FilaStaff>(
      "select id, org_id, location_id, role from public.staff where auth_user_id = $1",
      [usuarioDeAuth],
    )
    await cliente.query("rollback")
    const fila = resultado.rows[0]
    if (fila === undefined) {
      return null
    }
    return {
      staffId: fila.id,
      orgId: fila.org_id,
      locationId: fila.location_id,
      role: fila.role,
    }
  } finally {
    await cliente.end()
  }
}
