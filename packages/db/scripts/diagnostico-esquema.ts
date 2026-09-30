/**
 * Diagnostico de solo lectura del esquema aplicado en un Postgres gestionado.
 *
 * Temporal: sirve para comprobar en el Supabase real el historial de migraciones, el numero
 * de tablas, la ausencia de `prueba_runner` y el estado del rol de la aplicacion, cuando el
 * flujo "Instalar esquema" no llega a imprimir su resumen. No escribe nada y no imprime
 * ningun secreto.
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import { USUARIO_APP } from "../src/configuracion.ts"

const RUTA_CA = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))

function parametros(url: string, ca: string, password: string): ParametrosConexion {
  const partes = new URL(url)
  return {
    host: partes.hostname,
    port: partes.port === "" ? 5432 : Number(partes.port),
    database: partes.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(partes.username),
    password,
    ssl: true,
    ca,
    timeoutMs: 20_000,
  }
}

function usuarioDelRol(usuario: string, rol: string): string {
  const punto = usuario.indexOf(".")
  return punto === -1 ? rol : `${rol}${usuario.slice(punto)}`
}

const url = process.env.CAMARERO_DB_URL
const password = process.env.CAMARERO_DB_PASSWORD
const passwordApp = process.env.CAMARERO_DB_PASSWORD_APP
if (url === undefined || url === "" || password === undefined || password === "") {
  throw new Error("Faltan las credenciales de administrador")
}

const admin = parametros(url, await readFile(RUTA_CA, "utf8"), password)

const cliente = await conectar(admin)
try {
  const migraciones = await cliente.query<{ fichero: string }>(
    "select fichero from public.camarero_migraciones order by fichero",
  )
  process.stdout.write(
    `Historial (${migraciones.rows.length}): ${migraciones.rows.map((f) => f.fichero).join(", ")}\n`,
  )
  const tablas = await cliente.query<{ n: number }>(
    "select count(*)::int as n from pg_tables where schemaname = 'public'",
  )
  process.stdout.write(`Tablas en public: ${tablas.rows[0]?.n}\n`)
  const politicas = await cliente.query<{ n: number }>(
    "select count(*)::int as n from pg_policies where schemaname = 'public'",
  )
  process.stdout.write(`Politicas en public: ${politicas.rows[0]?.n}\n`)
  const prueba = await cliente.query<{ ausente: boolean }>(
    "select to_regclass('public.prueba_runner') is null as ausente",
  )
  process.stdout.write(`prueba_runner ausente: ${prueba.rows[0]?.ausente}\n`)
  const rol = await cliente.query<{ rolcanlogin: boolean; rolbypassrls: boolean }>(
    "select rolcanlogin, rolbypassrls from pg_roles where rolname = $1",
    [USUARIO_APP],
  )
  process.stdout.write(`Rol camarero_app: ${JSON.stringify(rol.rows[0])}\n`)
} finally {
  await cerrar(cliente)
}

// Prueba de autenticacion real del rol de la aplicacion, con reintentos: distingue un fallo
// de credencial de una cache del pooler que tarda en ver el cambio de contrasena.
async function intentar(): Promise<void> {
  const app: ParametrosConexion = {
    ...admin,
    user: usuarioDelRol(admin.user, USUARIO_APP),
    password: passwordApp ?? "",
  }
  const c = await conectar(app)
  try {
    const r = await c.query<{ n: number }>("select count(*)::int as n from public.orgs")
    process.stdout.write(`Autenticacion camarero_app: OK (orgs=${r.rows[0]?.n})\n`)
  } finally {
    await cerrar(c)
  }
}

for (let intento = 1; intento <= 3; intento += 1) {
  try {
    await intentar()
    break
  } catch (error) {
    process.stdout.write(
      `Autenticacion camarero_app intento ${intento}: FALLO (${error instanceof Error ? error.message : String(error)})\n`,
    )
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
}
