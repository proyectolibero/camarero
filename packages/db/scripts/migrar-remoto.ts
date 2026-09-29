/**
 * Instala el esquema en un Postgres remoto (Supabase).
 *
 * Lo lanza el flujo de trabajo "Instalar esquema" con la cadena de conexion del
 * administrador en la variable CAMARERO_DB_URL. NUNCA imprime la cadena ni ninguna
 * credencial: solo el resultado (migraciones, tablas y politicas), para poder comprobarlo
 * desde el registro del flujo sin exponer nada.
 *
 * Pasos: asegura el rol de la aplicacion (sin contrasena por ahora; se fija cuando se
 * conecte la app), aplica las migraciones en orden y concede los permisos al rol.
 */

import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import { USUARIO_APP } from "../src/configuracion.ts"
import { aplicarMigraciones } from "./aplicar-migraciones.ts"
import { asegurarRolDeAplicacion, concederPermisosDeAplicacion } from "./preparar-roles.ts"

function parametrosDesdeUrl(url: string): ParametrosConexion {
  const partes = new URL(url)
  const usuario = decodeURIComponent(partes.username)
  const contrasena = decodeURIComponent(partes.password)
  if (usuario === "" || contrasena === "") {
    throw new Error("La cadena de conexion no trae usuario o contrasena")
  }
  const ruta = partes.pathname.replace(/^\//, "")
  return {
    host: partes.hostname,
    port: partes.port === "" ? 5432 : Number(partes.port),
    database: ruta === "" ? "postgres" : ruta,
    user: usuario,
    password: contrasena,
    // TLS obligatorio, con verificacion del certificado.
    ssl: true,
    timeoutMs: 20_000,
  }
}

async function contar(cliente: ClientePostgres, sql: string): Promise<number> {
  const resultado = await cliente.query<{ n: number }>(sql)
  return resultado.rows[0]?.n ?? -1
}

async function informar(admin: ParametrosConexion, migraciones: number): Promise<void> {
  const cliente = await conectar(admin)
  try {
    const tablas = await contar(
      cliente,
      "select count(*)::int as n from pg_tables where schemaname = 'public'",
    )
    const politicas = await contar(
      cliente,
      "select count(*)::int as n from pg_policies where schemaname = 'public'",
    )
    process.stdout.write(`Migraciones aplicadas: ${migraciones}\n`)
    process.stdout.write(`Tablas en public: ${tablas}\n`)
    process.stdout.write(`Politicas en public: ${politicas}\n`)
  } finally {
    await cerrar(cliente)
  }
}

const url = process.env.CAMARERO_DB_URL
if (url === undefined || url === "") {
  throw new Error("Falta la variable CAMARERO_DB_URL con la cadena de conexion del administrador")
}

const admin = parametrosDesdeUrl(url)
await asegurarRolDeAplicacion(admin, USUARIO_APP, null)
const ficheros = await aplicarMigraciones(admin)
await concederPermisosDeAplicacion(admin, { ...admin, user: USUARIO_APP })
await informar(admin, ficheros.length)
