/**
 * Aplicacion de las migraciones SQL.
 *
 * Dos modos:
 *
 *  - **Sin historial** (por defecto): aplica todos los ficheros en orden. Es lo que usan los
 *    tests, que siempre parten de una base vacia.
 *  - **Con historial** (`registro`): salta los ficheros ya aplicados y anota cada uno. Es lo
 *    que necesita un Postgres remoto, donde el trabajo se repite: sin historial, la segunda
 *    ejecucion fallaria al intentar crear tablas que ya existen.
 *
 * Cada fichero se aplica en su propia transaccion: un fallo deja la base como estaba y
 * senala exactamente que migracion lo rompe.
 */
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

const DIRECTORIO_POR_DEFECTO = fileURLToPath(new URL("../migrations/", import.meta.url))

export type OpcionesDeMigracion = {
  /** Tabla de historial, cualificada (por ejemplo `public.camarero_migraciones`). */
  readonly registro?: string
}

async function aplicarFichero(
  cliente: ClientePostgres,
  directorio: string,
  fichero: string,
): Promise<void> {
  const sql = await readFile(join(directorio, fichero), "utf8")
  await cliente.query("begin")
  try {
    await cliente.query(sql)
    await cliente.query("commit")
  } catch (error) {
    await cliente.query("rollback")
    throw new Error(`Fallo la migracion ${fichero}`, { cause: error })
  }
}

async function listarFicheros(directorio: string): Promise<string[]> {
  const ficheros = (await readdir(directorio)).filter((fichero) => fichero.endsWith(".sql")).sort()
  if (ficheros.length === 0) {
    throw new Error(`No hay migraciones SQL en ${directorio}`)
  }
  return ficheros
}

async function anotar(cliente: ClientePostgres, registro: string, fichero: string): Promise<void> {
  await cliente.query(
    `insert into ${registro} (fichero) values ($1) on conflict (fichero) do nothing`,
    [fichero],
  )
}

/**
 * Linea base: la base ya tiene esquema pero el historial esta vacio (instalacion anterior a
 * que existiera el historial). Se anota todo lo que hay como aplicado en lugar de intentar
 * reaplicarlo y reventar.
 */
async function anotarLineaBase(
  cliente: ClientePostgres,
  registro: string,
  ficheros: readonly string[],
): Promise<void> {
  for (const fichero of ficheros) {
    await anotar(cliente, registro, fichero)
  }
}

async function existeEsquemaPrevio(cliente: ClientePostgres): Promise<boolean> {
  const resultado = await cliente.query<{ existe: boolean }>(
    "select to_regclass('public.orgs') is not null as existe",
  )
  return resultado.rows[0]?.existe === true
}

async function aplicarConHistorial(
  cliente: ClientePostgres,
  directorio: string,
  ficheros: readonly string[],
  registro: string,
): Promise<string[]> {
  await cliente.query(
    `create table if not exists ${registro} (fichero text primary key, aplicado_en timestamptz not null default now())`,
  )
  const filas = await cliente.query<{ fichero: string }>(`select fichero from ${registro}`)
  const aplicadas = new Set(filas.rows.map((fila) => fila.fichero))

  if (aplicadas.size === 0 && (await existeEsquemaPrevio(cliente))) {
    await anotarLineaBase(cliente, registro, ficheros)
    return []
  }

  const pendientes = ficheros.filter((fichero) => !aplicadas.has(fichero))
  for (const fichero of pendientes) {
    await aplicarFichero(cliente, directorio, fichero)
    await anotar(cliente, registro, fichero)
  }
  return pendientes
}

export async function aplicarMigraciones(
  conexion: ParametrosConexion,
  directorio: string = DIRECTORIO_POR_DEFECTO,
  opciones: OpcionesDeMigracion = {},
): Promise<string[]> {
  const ficheros = await listarFicheros(directorio)
  const cliente = await conectar(conexion)
  try {
    if (opciones.registro === undefined) {
      for (const fichero of ficheros) {
        await aplicarFichero(cliente, directorio, fichero)
      }
      return ficheros
    }
    return await aplicarConHistorial(cliente, directorio, ficheros, opciones.registro)
  } finally {
    await cerrar(cliente)
  }
}
