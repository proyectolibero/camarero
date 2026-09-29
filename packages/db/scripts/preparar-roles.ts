/**
 * Creacion de los dos roles del runner y reparto de permisos.
 *
 * El esquema se aplica como `camarero_owner` (propietario). Las pruebas se conectan
 * como `camarero_app`, que no posee nada y no tiene BYPASSRLS: en PostgreSQL el
 * propietario de una tabla ignora sus politicas RLS, asi que probar con el
 * propietario daria siempre verde sin probar la RLS (LL-004).
 */
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

function escaparLiteral(valor: string): string {
  return valor.replaceAll("'", "''")
}

async function ejecutarDeclaraciones(
  parametros: ParametrosConexion,
  declaraciones: string[],
): Promise<void> {
  const cliente = await conectar(parametros)
  try {
    for (const declaracion of declaraciones) {
      await cliente.query(declaracion)
    }
  } finally {
    await cerrar(cliente)
  }
}

export async function prepararRoles(
  admin: ParametrosConexion,
  owner: ParametrosConexion,
  app: ParametrosConexion,
): Promise<void> {
  const contrasenaOwner = escaparLiteral(owner.password)
  const contrasenaApp = escaparLiteral(app.password)
  await ejecutarDeclaraciones(admin, [
    `create role ${owner.user} login password '${contrasenaOwner}' nosuperuser nocreatedb nocreaterole nobypassrls`,
    `create role ${app.user} login password '${contrasenaApp}' nosuperuser nocreatedb nocreaterole nobypassrls`,
    // El propietario del esquema es quien crea las tablas; el rol de aplicacion solo lo usa.
    `alter schema public owner to ${owner.user}`,
    `grant usage on schema public to ${app.user}`,
  ])
}

export async function concederPermisosDeAplicacion(
  autor: ParametrosConexion,
  app: ParametrosConexion,
): Promise<void> {
  // Se ejecuta como propietario de las tablas (o como el administrador en un entorno
  // gestionado) y despues de migrar: los privilegios por defecto no alcanzan a lo ya
  // creado, asi que se conceden de forma explicita y se dejan fijados.
  await ejecutarDeclaraciones(autor, [
    `grant select, insert, update, delete on all tables in schema public to ${app.user}`,
    `grant usage, select on all sequences in schema public to ${app.user}`,
    `alter default privileges for role ${autor.user} in schema public grant select, insert, update, delete on tables to ${app.user}`,
  ])
}

/**
 * Modo gestionado (Supabase): el administrador ya existe y NO se crea ningun superusuario.
 *
 * Solo se asegura el rol de la aplicacion (sin BYPASSRLS y sin ser propietario de nada) y
 * se retiran los permisos por defecto que un Postgres gestionado concede a sus roles
 * publicos. Esos permisos son un agujero real: `service_role` tiene BYPASSRLS, asi que si
 * conserva acceso a nuestro esquema y su clave se filtra, el aislamiento deja de existir.
 */
export async function prepararRolDeAplicacion(
  admin: ParametrosConexion,
  app: ParametrosConexion,
): Promise<void> {
  await asegurarRolDeAplicacion(admin, app.user, app.password)
}

/**
 * Asegura el rol de la aplicacion, con o sin contrasena.
 *
 * Con `password` nula se crea SIN inicio de sesion (`nologin`): basta para que exista y
 * reciba los permisos al instalar el esquema. La contrasena se fija despues, cuando se
 * conecta la aplicacion de verdad, para no tener que repartir un secreto durante la
 * instalacion.
 */
export async function asegurarRolDeAplicacion(
  admin: ParametrosConexion,
  usuario: string,
  password: string | null,
): Promise<void> {
  const cliente = await conectar(admin)
  try {
    const atributos = password === null ? "nologin" : `login password '${escaparLiteral(password)}'`
    await crearRolSiNoExiste(
      cliente,
      `create role ${usuario} ${atributos} nosuperuser nocreatedb nocreaterole nobypassrls`,
    )
    await cliente.query(`grant usage on schema public to ${usuario}`)
    await revocarPermisosPorDefecto(cliente, ROLES_PUBLICOS_DE_SUPABASE)
  } finally {
    await cerrar(cliente)
  }
}

// Roles que un Postgres gestionado crea por su cuenta. Se revocan solo en el modo
// gestionado; en el Postgres de pruebas no existen y no hay nada que revocar.
const ROLES_PUBLICOS_DE_SUPABASE = ["anon", "authenticated", "service_role"]

function esRolDuplicado(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  // 42710 = duplicate_object. Repetir el aprovisionamiento es lo normal, no un fallo.
  return (error as { code?: unknown }).code === "42710"
}

async function crearRolSiNoExiste(cliente: ClientePostgres, declaracion: string): Promise<void> {
  try {
    await cliente.query(declaracion)
  } catch (error) {
    if (!esRolDuplicado(error)) {
      throw error
    }
  }
}

async function revocarPermisosPorDefecto(
  cliente: ClientePostgres,
  candidatos: readonly string[],
): Promise<void> {
  const existentes = await cliente.query<{ rolname: string }>(
    "select rolname from pg_roles where rolname = any($1::text[])",
    [candidatos],
  )
  const nombres = existentes.rows.map((fila) => fila.rolname)
  if (nombres.length === 0) {
    return
  }
  const lista = nombres.join(", ")
  await cliente.query(`revoke all on schema public from ${lista}`)
  await cliente.query(`revoke all on all tables in schema public from ${lista}`)
  await cliente.query(
    `alter default privileges in schema public revoke all on tables from ${lista}`,
  )
}
