/**
 * Cliente de PostgreSQL y utilidades de conexion del runner.
 *
 * Se centraliza aqui para que el resto del paquete no dependa de los detalles de `pg`
 * ni pueda olvidarse de cerrar un cliente: una conexion sin cerrar hace fallar el
 * apagado en silencio y deja la suite colgada.
 */

import type { QueryResultRow } from "pg"
import { Client } from "pg"

export type ParametrosConexion = {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export type ClientePostgres = Client

export async function conectar(parametros: ParametrosConexion): Promise<ClientePostgres> {
  const cliente = new Client({
    host: parametros.host,
    port: parametros.port,
    database: parametros.database,
    user: parametros.user,
    password: parametros.password,
    // Si el puerto no responde, mejor fallar rapido y reintentar que colgar la suite.
    connectionTimeoutMillis: 2_000,
  })
  await cliente.connect()
  return cliente
}

export async function cerrar(cliente: ClientePostgres | undefined): Promise<void> {
  if (cliente === undefined) {
    return
  }
  await cliente.end()
}

export function cadenaDeConexion(parametros: ParametrosConexion): string {
  const usuario = encodeURIComponent(parametros.user)
  const contrasena = encodeURIComponent(parametros.password)
  return `postgres://${usuario}:${contrasena}@${parametros.host}:${parametros.port}/${parametros.database}`
}

export async function consultar<T extends QueryResultRow>(
  parametros: ParametrosConexion,
  sql: string,
): Promise<T[]> {
  const cliente = await conectar(parametros)
  try {
    const resultado = await cliente.query<T>(sql)
    return resultado.rows
  } finally {
    await cerrar(cliente)
  }
}
