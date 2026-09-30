/**
 * DIAGNOSTICO DE LA RECETA DE CONTRASENA DE SUPABASE AUTH.
 *
 * Comprueba, SIN cambiar la contrasena de nadie, si la receta
 *   `update auth.users set encrypted_password = crypt(...) where email = <inexistente>`
 * se puede ejecutar en este proyecto y con que calificacion de esquema hay que escribir
 * `crypt` y `gen_salt`. El correo objetivo NO existe, asi que la sentencia afecta a cero
 * filas (se confirma eso): nunca toca a un usuario real. Ademas se envuelve en una
 * transaccion que se deshace, como red de seguridad adicional.
 *
 * NUNCA imprime hashes, contrasenas ni la cadena de conexion. Solo correos, fechas y
 * recuentos.
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

const RUTA_CA_POR_DEFECTO = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))

const CORREO_INEXISTENTE = "no-existe@prueba.test"
// Valor de relleno para la receta de prueba. No es una credencial de nadie.
const CLAVE_DE_RELLENO = "una-clave-cualquiera"

async function leerAutoridadCertificadora(): Promise<string> {
  return readFile(process.env.CAMARERO_DB_CA ?? RUTA_CA_POR_DEFECTO, "utf8")
}

function parametrosDesdeUrl(
  url: string,
  ca: string,
  contrasenaSeparada: string,
): ParametrosConexion {
  const partes = new URL(url)
  const usuario = decodeURIComponent(partes.username)
  const contrasena =
    contrasenaSeparada === "" ? decodeURIComponent(partes.password) : contrasenaSeparada
  if (usuario === "" || contrasena === "") {
    throw new Error("La cadena de conexion no trae usuario, o falta la contrasena")
  }
  const ruta = partes.pathname.replace(/^\//, "")
  return {
    host: partes.hostname,
    port: partes.port === "" ? 5432 : Number(partes.port),
    database: ruta === "" ? "postgres" : ruta,
    user: usuario,
    password: contrasena,
    ssl: true,
    ca,
    timeoutMs: 20_000,
  }
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

type ResultadoUpdate = { ok: true; filas: number } | { ok: false; mensaje: string }

/**
 * Intenta la sentencia con el calificativo que se le pase. Se ejecuta dentro de una
 * transaccion que SIEMPRE se deshace: aunque el WHERE fallara y apuntara a un usuario real,
 * nada queda escrito. `rowCount` es valido antes del rollback.
 */
async function probarReceta(
  cliente: ClientePostgres,
  calificativo: string,
): Promise<ResultadoUpdate> {
  const crypt = calificativo === "" ? "crypt" : `${calificativo}.crypt`
  const genSalt = calificativo === "" ? "gen_salt" : `${calificativo}.gen_salt`
  const sql = `update auth.users set encrypted_password = ${crypt}($1, ${genSalt}('bf', 10)) where email = $2`
  try {
    await cliente.query("begin")
    const resultado = await cliente.query(sql, [CLAVE_DE_RELLENO, CORREO_INEXISTENTE])
    await cliente.query("rollback")
    return { ok: true, filas: resultado.rowCount ?? -1 }
  } catch (error) {
    await cliente.query("rollback").catch(() => undefined)
    return { ok: false, mensaje: mensajeDeError(error) }
  }
}

type FichaUsuario = {
  email: string | null
  email_confirmed_at: Date | null
  created_at: Date | null
  last_sign_in_at: Date | null
}

async function leerFichaUsuario(cliente: ClientePostgres): Promise<FichaUsuario | null> {
  const resultado = await cliente.query<FichaUsuario>(
    "select email, email_confirmed_at, created_at, last_sign_in_at from auth.users where email = $1",
    ["dueno@prueba.test"],
  )
  return resultado.rows[0] ?? null
}

function formatearFecha(valor: Date | null): string {
  return valor === null ? "NULL" : valor.toISOString()
}

const url = process.env.CAMARERO_DB_URL_ADMIN
const contrasena = process.env.CAMARERO_DB_PASSWORD_ADMIN
if (url === undefined || url === "") {
  throw new Error(
    "Falta la variable CAMARERO_DB_URL_ADMIN con la cadena de conexion del administrador",
  )
}
if (contrasena === undefined || contrasena === "") {
  throw new Error(
    "Falta la variable CAMARERO_DB_PASSWORD_ADMIN con la contrasena del administrador",
  )
}

const admin = parametrosDesdeUrl(url, await leerAutoridadCertificadora(), contrasena)
const cliente = await conectar(admin)
try {
  process.stdout.write("== Receta sin cualificar (crypt / gen_salt) ==\n")
  const sinCualificar = await probarReceta(cliente, "")
  if (sinCualificar.ok) {
    process.stdout.write(`OK · sentencia ejecutada · resultado: UPDATE ${sinCualificar.filas}\n`)
  } else {
    process.stdout.write(`FALLO · error literal: ${sinCualificar.mensaje}\n`)
    process.stdout.write("== Reintento con prefijo extensions. ==\n")
    const conPrefijo = await probarReceta(cliente, "extensions")
    if (conPrefijo.ok) {
      process.stdout.write(`OK · sentencia ejecutada · resultado: UPDATE ${conPrefijo.filas}\n`)
    } else {
      process.stdout.write(`FALLO · error literal: ${conPrefijo.mensaje}\n`)
    }
  }

  process.stdout.write("== Estado del usuario dueno@prueba.test ==\n")
  const ficha = await leerFichaUsuario(cliente)
  if (ficha === null) {
    process.stdout.write("No existe ninguna fila en auth.users con ese correo.\n")
  } else {
    process.stdout.write(`email: ${ficha.email}\n`)
    process.stdout.write(`email_confirmed_at: ${formatearFecha(ficha.email_confirmed_at)}\n`)
    process.stdout.write(`created_at: ${formatearFecha(ficha.created_at)}\n`)
    process.stdout.write(`last_sign_in_at: ${formatearFecha(ficha.last_sign_in_at)}\n`)
  }
} finally {
  await cerrar(cliente)
}
