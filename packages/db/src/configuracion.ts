/**
 * Parametros del entorno de pruebas, siempre desde variables de entorno.
 *
 * Los valores por defecto son deliberadamente falsos: el repositorio es publico
 * (AGPL) y no puede contener ningun secreto real. El puerto por defecto evita el
 * 5432, ocupado por los PostgreSQL nativos de la maquina de desarrollo (RISK-015).
 */
import type { ParametrosConexion } from "./conexion.ts"

export const IMAGEN_POSTGRES = "postgres:17-alpine"
export const USUARIO_ADMIN = "camarero_admin"
export const USUARIO_OWNER = "camarero_owner"
export const USUARIO_APP = "camarero_app"

/**
 * Entorno de base de datos.
 *
 *  - `local`: el Postgres de Docker. Se crean los tres roles (admin, dueno y aplicacion) y
 *    el esquema `public` pasa a ser del dueno, que no tiene BYPASSRLS.
 *  - `gestionado`: un Postgres gestionado tipo Supabase. El administrador ya existe (es
 *    `postgres`, con BYPASSRLS) y no se crea ningun superusuario; solo se crea el rol de
 *    la aplicacion. Sirve para comprobar en local que el mismo esquema se aplica alli.
 */
export type ModoDeBase = "local" | "gestionado"

const CONTRASENA_POR_DEFECTO = "clave_de_prueba_no_real"

export type ParametrosDePrueba = {
  admin: ParametrosConexion
  owner: ParametrosConexion
  app: ParametrosConexion
}

function variable(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre]
  return valor === undefined || valor.length === 0 ? porDefecto : valor
}

export function puertoDePrueba(): number {
  const puerto = Number(variable("CAMARERO_TEST_DB_PORT", "54322"))
  if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65_535) {
    throw new Error(`CAMARERO_TEST_DB_PORT no es un puerto valido: ${String(puerto)}`)
  }
  return puerto
}

export function modoDeBase(): ModoDeBase {
  const modo = variable("CAMARERO_DB_MODO", "local")
  if (modo !== "local" && modo !== "gestionado") {
    throw new Error(`CAMARERO_DB_MODO no es un modo valido: ${modo} (usa local o gestionado)`)
  }
  return modo
}

function parametros(usuario: string): ParametrosConexion {
  return {
    host: variable("CAMARERO_TEST_DB_HOST", "127.0.0.1"),
    port: puertoDePrueba(),
    database: variable("CAMARERO_TEST_DB_NAME", "camarero_test"),
    user: usuario,
    password: variable("CAMARERO_TEST_DB_PASSWORD", CONTRASENA_POR_DEFECTO),
  }
}

export function parametrosDePrueba(): ParametrosDePrueba {
  return {
    admin: parametros(USUARIO_ADMIN),
    owner: parametros(USUARIO_OWNER),
    app: parametros(USUARIO_APP),
  }
}
