/**
 * Aplicacion de las migraciones SQL como `camarero_owner`.
 *
 * Cada fichero se aplica en su propia transaccion y en orden de nombre: un fallo deja
 * la base como estaba y senala exactamente que migracion lo rompe.
 */
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

const DIRECTORIO_POR_DEFECTO = fileURLToPath(new URL("../migrations/", import.meta.url))

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

export async function aplicarMigraciones(
  owner: ParametrosConexion,
  directorio: string = DIRECTORIO_POR_DEFECTO,
): Promise<string[]> {
  const ficheros = (await readdir(directorio)).filter((f) => f.endsWith(".sql")).sort()
  if (ficheros.length === 0) {
    throw new Error(`No hay migraciones SQL en ${directorio}`)
  }
  const cliente = await conectar(owner)
  try {
    for (const fichero of ficheros) {
      await aplicarFichero(cliente, directorio, fichero)
    }
  } finally {
    await cerrar(cliente)
  }
  return ficheros
}
