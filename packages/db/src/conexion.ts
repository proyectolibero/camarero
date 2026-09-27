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

    // `pg` devuelve un ARRAY de resultados cuando la cadena trae varias sentencias, y un
    // unico resultado cuando trae una. Acceder a `.rows` directamente funcionaba con una
    // sentencia y devolvia `undefined` con varias, sin lanzar: el fallo aparecia despues,
    // como un TypeError en quien consumia el resultado. Aqui se normaliza: de una cadena
    // con varias sentencias interesa el resultado de la ULTIMA, que es donde las consultas
    // de este paquete dejan el `select` final.
    const ultimo = Array.isArray(resultado) ? resultado.at(-1) : resultado
    return ultimo?.rows ?? []
  } finally {
    await cerrar(cliente)
  }
}
