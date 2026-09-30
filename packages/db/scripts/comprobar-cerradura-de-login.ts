/**
 * COMPRUEBA LA CERRADURA DEL LOGIN CON DATOS REALES.
 *
 * Este script NO crea nada: lee la ficha sembrada por `sembrar-empleado-de-prueba.ts` y
 * verifica, contra el Postgres de verdad, que la cerradura de la 0015 funciona:
 *
 *   - Con el contexto del token fijado (request.jwt.claims.sub), el rol de la aplicacion
 *     ve EXACTAMENTE 1 fila de `staff`: la suya.
 *   - Sin el contexto, ve 0 filas.
 *
 * Se conecta con el rol `camarero_app` (CAMARERO_DB_PASSWORD_APP) y NUNCA imprime
 * credenciales. Si la cerradura no da 1 y 0, termina con error para que el flujo de
 * trabajo falle en vez de dar un falso verde.
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import { USUARIO_APP } from "../src/configuracion.ts"

const RUTA_CA_POR_DEFECTO = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))
const EMAIL_POR_DEFECTO = "dueno@prueba.test"

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

/** En el pooler el rol se conecta como `<rol>.<referencia>`; sin punto, tal cual. */
function usuarioDelRol(usuarioActual: string, rol: string): string {
  const punto = usuarioActual.indexOf(".")
  return punto === -1 ? rol : `${rol}${usuarioActual.slice(punto)}`
}

function leerEmail(): string {
  const valor = process.env.CAMARERO_EMPLEADO_EMAIL
  return valor === undefined || valor.trim() === "" ? EMAIL_POR_DEFECTO : valor.trim()
}

async function leerUsuarioDeAuth(admin: ParametrosConexion, email: string): Promise<string> {
  const cliente = await conectar(admin)
  try {
    const resultado = await cliente.query<{ auth_user_id: string | null }>(
      "select auth_user_id from public.staff where email = $1",
      [email],
    )
    const id = resultado.rows[0]?.auth_user_id
    if (id === undefined || id === null) {
      throw new Error(`No hay ficha de staff sembrada y enlazada para el correo ${email}`)
    }
    return id
  } finally {
    await cerrar(cliente)
  }
}

async function contarVisibles(cliente: ClientePostgres, authUserId: string): Promise<number> {
  const resultado = await cliente.query<{ n: number }>(
    "select count(*)::int as n from public.staff where auth_user_id = $1",
    [authUserId],
  )
  return resultado.rows[0]?.n ?? -1
}

/**
 * En una misma transaccion se fija la reclamacion `sub` (local a la transaccion) y se
 * cuenta. Despues, en otra transaccion sin contexto, se vuelve a contar: el contraste es
 * la prueba de que no hay ningun atajo que vea la fila sin presentar la credencial.
 */
async function comprobar(app: ParametrosConexion, authUserId: string): Promise<[number, number]> {
  const cliente = await conectar(app)
  try {
    await cliente.query("begin")
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: authUserId }),
    ])
    const conContexto = await contarVisibles(cliente, authUserId)
    await cliente.query("commit")

    await cliente.query("begin")
    const sinContexto = await contarVisibles(cliente, authUserId)
    await cliente.query("rollback")
    return [conContexto, sinContexto]
  } finally {
    await cerrar(cliente)
  }
}

const url = process.env.CAMARERO_DB_URL_ADMIN
const contrasenaAdmin = process.env.CAMARERO_DB_PASSWORD_ADMIN
const contrasenaApp = process.env.CAMARERO_DB_PASSWORD_APP
if (url === undefined || url === "") {
  throw new Error(
    "Falta la variable CAMARERO_DB_URL_ADMIN con la cadena de conexion del administrador",
  )
}
if (contrasenaAdmin === undefined || contrasenaAdmin === "") {
  throw new Error("Falta la variable CAMARERO_DB_PASSWORD_ADMIN")
}
if (contrasenaApp === undefined || contrasenaApp === "") {
  throw new Error(
    "Falta la variable CAMARERO_DB_PASSWORD_APP con la contrasena del rol de la aplicacion",
  )
}

const email = leerEmail()
const admin = parametrosDesdeUrl(url, await leerAutoridadCertificadora(), contrasenaAdmin)
const authUserId = await leerUsuarioDeAuth(admin, email)
const app: ParametrosConexion = {
  ...admin,
  user: usuarioDelRol(admin.user, USUARIO_APP),
  password: contrasenaApp,
}

const [conContexto, sinContexto] = await comprobar(app, authUserId)
process.stdout.write(`Con contexto: ${conContexto} (esperado 1)\n`)
process.stdout.write(`Sin contexto: ${sinContexto} (esperado 0)\n`)
if (conContexto !== 1 || sinContexto !== 0) {
  throw new Error(
    `La cerradura del login no se comporta como exige el contrato: esperaba 1 con contexto y 0 sin el, obtuve ${conContexto} y ${sinContexto}`,
  )
}
