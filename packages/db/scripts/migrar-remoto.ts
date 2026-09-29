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

import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import { USUARIO_APP } from "../src/configuracion.ts"
import { aplicarMigraciones } from "./aplicar-migraciones.ts"
import { asegurarRolDeAplicacion, concederPermisosDeAplicacion } from "./preparar-roles.ts"

// Certificado raiz PUBLICO de Supabase, incluido en el repositorio para no desactivar la
// verificacion: la conexion sigue comprobando el certificado, solo que ahora conoce cual es
// la autoridad correcta. Caduca el 2031-04-26; si Supabase lo rota, hay que actualizarlo.
const RUTA_CA_POR_DEFECTO = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))

async function leerAutoridadCertificadora(): Promise<string> {
  const ruta = process.env.CAMARERO_DB_CA ?? RUTA_CA_POR_DEFECTO
  return readFile(ruta, "utf8")
}

function parametrosDesdeUrl(
  url: string,
  ca: string,
  contrasenaSeparada?: string,
): ParametrosConexion {
  const partes = new URL(url)
  const usuario = decodeURIComponent(partes.username)
  // La contrasena puede venir en su propio secreto. Es lo preferible: dentro de una URL hay
  // que codificarla, y un caracter como #, @, % o : sin codificar la corta en silencio.
  const contrasena = contrasenaSeparada ?? decodeURIComponent(partes.password)
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
    // TLS obligatorio, con verificacion del certificado contra la CA de Supabase.
    ssl: true,
    ca,
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

/** Diagnostico seguro: host y forma del usuario, NUNCA la contrasena. */
function describirDestino(parametros: ParametrosConexion): string {
  const conReferencia = parametros.user.includes(".") ? "si" : "no"
  return `Destino: ${parametros.host}:${parametros.port} (usuario con referencia de proyecto: ${conReferencia})`
}

/**
 * Diagnostico de la contrasena SIN revelarla: solo dos indicios que explican casi todos los
 * fallos de autenticacion al copiarla (un espacio o salto invisible en los extremos, o que
 * se haya pegado ya codificada para URL).
 */
function describirCredencial(contrasena: string): string {
  const conEspaciosEnLosExtremos = contrasena !== contrasena.trim()
  const pareceCodificadaEnUrl = /%(?:[0-9a-fA-F]{2})/.test(contrasena)
  return `Credencial: extremos con espacios o saltos: ${conEspaciosEnLosExtremos ? "si" : "no"}; parece codificada en URL: ${pareceCodificadaEnUrl ? "si" : "no"}`
}

const url = process.env.CAMARERO_DB_URL
if (url === undefined || url === "") {
  throw new Error("Falta la variable CAMARERO_DB_URL con la cadena de conexion del administrador")
}

const admin = parametrosDesdeUrl(
  url,
  await leerAutoridadCertificadora(),
  process.env.CAMARERO_DB_PASSWORD,
)
process.stdout.write(`${describirDestino(admin)}\n`)
process.stdout.write(`${describirCredencial(admin.password)}\n`)
await asegurarRolDeAplicacion(admin, USUARIO_APP, null)
const ficheros = await aplicarMigraciones(admin)
await concederPermisosDeAplicacion(admin, { ...admin, user: USUARIO_APP })
await informar(admin, ficheros.length)
