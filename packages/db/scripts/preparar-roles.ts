/**
 * Creacion de los dos roles del runner y reparto de permisos.
 *
 * El esquema se aplica como `camarero_owner` (propietario). Las pruebas se conectan
 * como `camarero_app`, que no posee nada y no tiene BYPASSRLS: en PostgreSQL el
 * propietario de una tabla ignora sus politicas RLS, asi que probar con el
 * propietario daria siempre verde sin probar la RLS (LL-004).
 */
import type { ParametrosConexion } from "../src/conexion.ts"
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
  owner: ParametrosConexion,
  app: ParametrosConexion,
): Promise<void> {
  // Se ejecuta como propietario y despues de migrar: los privilegios por defecto no
  // alcanzan a lo ya creado, asi que se conceden de forma explicita y se dejan fijados.
  await ejecutarDeclaraciones(owner, [
    `grant select, insert, update, delete on all tables in schema public to ${app.user}`,
    `grant usage, select on all sequences in schema public to ${app.user}`,
    `alter default privileges for role ${owner.user} in schema public grant select, insert, update, delete on tables to ${app.user}`,
  ])
}
