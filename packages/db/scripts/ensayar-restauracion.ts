/**
 * ENSAYO DE RESTAURACION DE UNA COPIA.
 *
 * Lo lanza el flujo "Copias de seguridad" despues de volcar, cifrar, subir y restaurar la
 * copia recien hecha en un contenedor de PostgreSQL limpio. Este script NO restaura: compara
 * la base de origen (Supabase) con la restaurada y decide si la copia vale:
 *
 *   - Mismo numero de tablas en `public`.
 *   - Mismas filas en `orgs`, `locations` y `staff` (se comparan contra el origen, no contra
 *     un numero escrito a mano: un numero fijo se queda obsoleto y da falsos verdes).
 *   - Mismas cuentas en `auth.users` (sin esto, un restore deja el sistema sin ningun usuario).
 *   - Prueba de aislamiento: el rol de la aplicacion SIN contexto ve CERO filas.
 *
 * Si algo no cuadra, termina con error para que el flujo se ponga en ROJO. NUNCA imprime
 * credenciales.
 *
 * Variables de entorno:
 *   CAMARERO_DB_URL_ADMIN, CAMARERO_DB_PASSWORD_ADMIN  -> origen (Supabase, TLS con CA)
 *   CAMARERO_RESTAURADA_URL                             -> restaurada (Postgres local, sin TLS)
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import { compararMetricas, type MetricasDeRestauracion } from "../src/restauracion.ts"

// Certificado raiz PUBLICO de Supabase, incluido para no desactivar la verificacion TLS.
const RUTA_CA_POR_DEFECTO = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))

const ROL_APP = "camarero_app"
// Contrasena efimera del rol, solo para este contenedor de usar y tirar. Nunca sale de aqui.
const CONTRASENA_ENSAYO = "solo-para-el-ensayo-de-restauracion"

async function leerAutoridadCertificadora(): Promise<string> {
  return readFile(process.env.CAMARERO_DB_CA ?? RUTA_CA_POR_DEFECTO, "utf8")
}

type OpcionesDeConexion = {
  readonly ssl: boolean
  readonly ca?: string
  readonly contrasenaSeparada?: string
  readonly timeoutMs: number
}

function parametrosDesdeUrl(url: string, opciones: OpcionesDeConexion): ParametrosConexion {
  const partes = new URL(url)
  const usuario = decodeURIComponent(partes.username)
  const contrasena = opciones.contrasenaSeparada ?? decodeURIComponent(partes.password)
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
    ssl: opciones.ssl,
    ...(opciones.ca === undefined ? {} : { ca: opciones.ca }),
    timeoutMs: opciones.timeoutMs,
  }
}

async function contar(cliente: ClientePostgres, sql: string): Promise<number> {
  const resultado = await cliente.query<{ n: number }>(sql)
  const n = resultado.rows[0]?.n
  if (n === undefined) {
    throw new Error(`La consulta no devolvio un recuento: ${sql}`)
  }
  return n
}

async function medir(parametros: ParametrosConexion): Promise<MetricasDeRestauracion> {
  const cliente = await conectar(parametros)
  try {
    return {
      tablasPublicas: await contar(
        cliente,
        "select count(*)::int as n from pg_tables where schemaname = 'public'",
      ),
      orgs: await contar(cliente, "select count(*)::int as n from public.orgs"),
      locations: await contar(cliente, "select count(*)::int as n from public.locations"),
      staff: await contar(cliente, "select count(*)::int as n from public.staff"),
      authUsers: await contar(cliente, "select count(*)::int as n from auth.users"),
    }
  } finally {
    await cerrar(cliente)
  }
}

async function prepararRolDeEnsayo(restaurada: ParametrosConexion): Promise<void> {
  const cliente = await conectar(restaurada)
  try {
    const existe = await contar(
      cliente,
      `select count(*)::int as n from pg_roles where rolname = '${ROL_APP}'`,
    )
    if (existe === 0) {
      await cliente.query(
        `create role ${ROL_APP} nosuperuser nobypassrls login password '${CONTRASENA_ENSAYO}'`,
      )
    }
    await cliente.query(`grant usage on schema public to ${ROL_APP}`)
    await cliente.query(`grant select on all tables in schema public to ${ROL_APP}`)
  } finally {
    await cerrar(cliente)
  }
}

async function probarAislamiento(restaurada: ParametrosConexion): Promise<number> {
  const app: ParametrosConexion = {
    ...restaurada,
    user: ROL_APP,
    password: CONTRASENA_ENSAYO,
  }
  const cliente = await conectar(app)
  try {
    return await contar(cliente, "select count(*)::int as n from public.orgs")
  } finally {
    await cerrar(cliente)
  }
}

function exigirVariable(nombre: string): string {
  const valor = process.env[nombre]
  if (valor === undefined || valor === "") {
    throw new Error(`Falta la variable ${nombre}`)
  }
  return valor
}

const urlAdmin = exigirVariable("CAMARERO_DB_URL_ADMIN")
const contrasenaAdmin = exigirVariable("CAMARERO_DB_PASSWORD_ADMIN")
const urlRestaurada = exigirVariable("CAMARERO_RESTAURADA_URL")

const origen = parametrosDesdeUrl(urlAdmin, {
  ssl: true,
  ca: await leerAutoridadCertificadora(),
  contrasenaSeparada: contrasenaAdmin,
  timeoutMs: 20_000,
})
const restaurada = parametrosDesdeUrl(urlRestaurada, { ssl: false, timeoutMs: 5_000 })

const metricasOrigen = await medir(origen)
const metricasRestaurada = await medir(restaurada)

const comparacion = compararMetricas(metricasOrigen, metricasRestaurada)
for (const linea of comparacion.lineas) {
  process.stdout.write(`${linea}\n`)
}
if (metricasRestaurada.orgs === 0) {
  // Una copia sin filas pasaria todas las comparaciones si el origen tambien estuviera
  // vacio; en produccion no lo esta, y un cero delator es mejor que un verde enganoso.
  throw new Error("La restauracion quedo sin filas en public.orgs: la copia no sirve")
}
if (!comparacion.ok) {
  throw new Error(
    `La restauracion no coincide con el origen en ${comparacion.discrepancias} metricas`,
  )
}

await prepararRolDeEnsayo(restaurada)
const visiblesSinContexto = await probarAislamiento(restaurada)
process.stdout.write(
  `Aislamiento en el restaurado: el rol de la app sin contexto ve ${visiblesSinContexto} filas (esperado 0)\n`,
)
if (visiblesSinContexto !== 0) {
  throw new Error(
    `La RLS no sobrevivio a la restauracion: el rol de la app sin contexto ve ${visiblesSinContexto} filas en public.orgs`,
  )
}

process.stdout.write("ENSAYO DE RESTAURACION: OK\n")
