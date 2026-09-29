/**
 * Creacion de roles y reparto de permisos.
 *
 * En el Postgres local se crean tres roles (administrador, dueno y aplicacion). En un
 * Postgres gestionado (Supabase) el administrador ya existe y solo se asegura el rol de la
 * aplicacion, que nunca tiene BYPASSRLS ni es propietario de nada.
 *
 * Cuidado con los identificadores: en Supabase la conexion se hace con el usuario del pooler
 * `postgres.<referencia>`, que lleva un punto. Un nombre con punto interpolado sin comillas
 * es un error de sintaxis. Todos los nombres van entrecomillados con `citar`.
 */
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

function escaparLiteral(valor: string): string {
  return valor.replaceAll("'", "''")
}

/** Entrecomilla un identificador para SQL. No es cosmetica: los nombres con punto lo exigen. */
function citar(nombre: string): string {
  return `"${nombre.replaceAll('"', '""')}"`
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
    `create role ${citar(owner.user)} login password '${contrasenaOwner}' nosuperuser nocreatedb nocreaterole nobypassrls`,
    `create role ${citar(app.user)} login password '${contrasenaApp}' nosuperuser nocreatedb nocreaterole nobypassrls`,
    // El propietario del esquema es quien crea las tablas; el rol de aplicacion solo lo usa.
    `alter schema public owner to ${citar(owner.user)}`,
    `grant usage on schema public to ${citar(app.user)}`,
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
    `grant select, insert, update, delete on all tables in schema public to ${citar(app.user)}`,
    `grant usage, select on all sequences in schema public to ${citar(app.user)}`,
    // Sin la clausula FOR ROLE: se aplica al rol actual, que es quien creo las tablas. No se
    // puede interpolar el nombre de usuario porque en el pooler de Supabase es
    // `postgres.<referencia>`, que NO es un rol real de PostgreSQL.
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${citar(app.user)}`,
  ])
}

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
      `create role ${citar(usuario)} ${atributos} nosuperuser nocreatedb nocreaterole nobypassrls`,
    )
    await cliente.query(`grant usage on schema public to ${citar(usuario)}`)
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
  const lista = nombres.map((nombre) => citar(nombre)).join(", ")
  await cliente.query(`revoke all on schema public from ${lista}`)
  await cliente.query(`revoke all on all tables in schema public from ${lista}`)
  await cliente.query(
    `alter default privileges in schema public revoke all on tables from ${lista}`,
  )
}
