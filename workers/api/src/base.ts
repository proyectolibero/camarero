/**
 * Acceso del borde a la base de datos, a traves de Hyperdrive.
 *
 * El borde es la unica puerta: fija el contexto de identidad (`app.*`) dentro de una
 * transaccion corta y consulta. La transaccion es obligatoria: con el pool de Hyperdrive, un
 * contexto fijado a nivel de sesion podria filtrarse a la peticion siguiente.
 *
 * Aqui NO se resuelve el pasaporte: eso se hace antes, verificando la firma. Esta capa recibe
 * ya el identificador de usuario de confianza.
 *
 * El nombre de cada clave de contexto (`app.staff_id`, `app.org_id`, `app.role`,
 * `app.location_id`) es EXACTAMENTE el que leen `staff_actual()`, `en_mi_org()` (via
 * `org_actual()` y `rol_actual()`) y `es_platform_admin()` (via `rol_actual()`) en la
 * migracion `0009_contexto_rls.sql`. Si se escribieran mal, la politica no fallaria: devolveria
 * cero filas, que es un fallo silencioso.
 */
import { Client } from "pg"

export type Organizacion = {
  readonly id: string
  readonly nombre: string | null
}

export type Local = {
  readonly id: string
  readonly nombre: string | null
}

/** Ficha resuelta de un empleado: lo que el panel necesita para dibujar. */
export type Empleado = {
  readonly staffId: string
  readonly correo: string
  readonly nombre: string
  readonly rol: string
  readonly organizacion: Organizacion
  readonly local: Local | null
}

type FilaStaff = {
  readonly id: string
  readonly org_id: string
  readonly location_id: string | null
  readonly role: string
  readonly email: string
  readonly display_name: string
}

type FilaNombres = {
  readonly org_nombre: string | null
  readonly local_nombre: string | null
}

/** Los cuatro valores que `staff_actual()`, `en_mi_org()` y `es_platform_admin()` leen. */
export type ContextoDeEmpleado = {
  readonly staffId: string
  readonly orgId: string
  readonly rol: string
  readonly locationId: string | null
}

/**
 * Fija las cuatro claves de contexto que leen las funciones de alcance. Se hace dentro de la
 * transaccion (`is_local = true`) para que desaparezca al terminar.
 *
 * Es la unica via de fijar identidad. Vive aqui para que tanto el inicio de sesion como la
 * gestion del panel (zonas, mesas) compartan exactamente la misma cerradura, en lugar de
 * repetir los nombres de las claves, que si se escriben mal fallan en silencio (cero filas).
 */
export async function fijarContextoDeEmpleado(
  cliente: Client,
  contexto: ContextoDeEmpleado,
): Promise<void> {
  const ajustes: readonly (readonly [string, string])[] = [
    ["app.staff_id", contexto.staffId],
    ["app.org_id", contexto.orgId],
    ["app.role", contexto.rol],
    ["app.location_id", contexto.locationId ?? ""],
  ]
  for (const [clave, valor] of ajustes) {
    await cliente.query("select set_config($1::text, $2::text, true)", [clave, valor])
  }
}

function fijarContexto(cliente: Client, fila: FilaStaff): Promise<void> {
  return fijarContextoDeEmpleado(cliente, {
    staffId: fila.id,
    orgId: fila.org_id,
    rol: fila.role,
    locationId: fila.location_id,
  })
}

function componerEmpleado(fila: FilaStaff, nombres: FilaNombres | undefined): Empleado {
  return {
    staffId: fila.id,
    correo: fila.email,
    nombre: fila.display_name,
    rol: fila.role,
    organizacion: { id: fila.org_id, nombre: nombres?.org_nombre ?? null },
    local:
      fila.location_id === null
        ? null
        : { id: fila.location_id, nombre: nombres?.local_nombre ?? null },
  }
}

/**
 * Busca la ficha de empleado vinculada al usuario de Supabase Auth y lee los nombres de su
 * organizacion y local.
 *
 * Primero se fija la reclamacion del token para que la cerradura minima de `staff`
 * (`staff_select_auth`) permita ver esa fila. Con la fila ya se fija el contexto `app.*`, que
 * es lo que deja leer la organizacion y el local segun el rol. Todo en una sola transaccion
 * corta.
 */
export async function resolverSesion(
  cadenaConexion: string,
  usuarioDeAuth: string,
): Promise<Empleado | null> {
  const cliente = new Client({ connectionString: cadenaConexion })
  await cliente.connect()
  try {
    await cliente.query("begin")
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: usuarioDeAuth }),
    ])
    const resultado = await cliente.query<FilaStaff>(
      "select id, org_id, location_id, role, email, display_name from public.staff where auth_user_id = $1",
      [usuarioDeAuth],
    )
    const fila = resultado.rows[0]
    if (fila === undefined) {
      await cliente.query("rollback")
      return null
    }
    await fijarContexto(cliente, fila)
    const nombres = await cliente.query<FilaNombres>(
      `select o.name as org_nombre, l.name as local_nombre
       from public.staff s
       left join public.orgs o on o.id = s.org_id
       left join public.locations l on l.id = s.location_id
       where s.id = $1`,
      [fila.id],
    )
    await cliente.query("rollback")
    return componerEmpleado(fila, nombres.rows[0])
  } finally {
    await cliente.end()
  }
}
