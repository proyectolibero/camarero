/**
 * Instala el esquema en un Postgres remoto (Supabase).
 *
 * Lo lanza el flujo de trabajo "Instalar esquema" con la cadena de conexion del
 * administrador en la variable CAMARERO_DB_URL y la contrasena en CAMARERO_DB_PASSWORD. NUNCA
 * imprime la cadena ni la contrasena: solo el resultado y dos diagnosticos sin datos
 * sensibles (host y forma de la credencial), para poder comprobarlo desde el registro del
 * flujo sin exponer nada.
 *
 * Pasos: asegura el rol de la aplicacion (sin contrasena por ahora; se fija cuando se conecte
 * la app), aplica las migraciones pendientes segun el historial y concede los permisos.
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

// Historial de migraciones aplicadas. Sin el, una segunda ejecucion intentaria crear tablas
// que ya existen y fallaria.
const REGISTRO = "public.camarero_migraciones"

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

/** Diagnostico seguro: host y forma del usuario, NUNCA la contrasena. */
function describirDestino(parametros: ParametrosConexion): string {
  const conReferencia = parametros.user.includes(".") ? "si" : "no"
  return `Destino: ${parametros.host}:${parametros.port} (usuario con referencia de proyecto: ${conReferencia})`
}

/**
 * Diagnostico de la contrasena SIN revelarla: dos indicios que explican casi todos los fallos
 * de autenticacion al copiarla (un espacio o salto invisible en los extremos, o que se haya
 * pegado ya codificada para URL).
 */
function describirCredencial(contrasena: string): string {
  const conEspaciosEnLosExtremos = contrasena !== contrasena.trim()
  const pareceCodificadaEnUrl = /%(?:[0-9a-fA-F]{2})/.test(contrasena)
  return `Credencial: extremos con espacios o saltos: ${conEspaciosEnLosExtremos ? "si" : "no"}; parece codificada en URL: ${pareceCodificadaEnUrl ? "si" : "no"}`
}

/**
 * Contrasena del rol de la aplicacion, si el despliegue la aporta. Sin ella, el rol se deja
 * sin inicio de sesion (basta para instalar el esquema); con ella, queda listo para que el
 * borde se conecte.
 */
function leerContrasenaDeLaApp(): string | null {
  const valor = process.env.CAMARERO_DB_PASSWORD_APP
  return valor === undefined || valor === "" ? null : valor
}

async function informar(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    const migraciones = await contar(cliente, `select count(*)::int as n from ${REGISTRO}`)
    const tablas = await contar(
      cliente,
      "select count(*)::int as n from pg_tables where schemaname = 'public'",
    )
    const politicas = await contar(
      cliente,
      "select count(*)::int as n from pg_policies where schemaname = 'public'",
    )
    process.stdout.write(`Migraciones en el historial: ${migraciones}\n`)
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

const admin = parametrosDesdeUrl(
  url,
  await leerAutoridadCertificadora(),
  process.env.CAMARERO_DB_PASSWORD,
)
process.stdout.write(`${describirDestino(admin)}\n`)
process.stdout.write(`${describirCredencial(admin.password)}\n`)

await asegurarRolDeAplicacion(admin, USUARIO_APP, leerContrasenaDeLaApp())
const aplicadas = await aplicarMigraciones(admin, undefined, { registro: REGISTRO })
process.stdout.write(`Migraciones aplicadas en esta ejecucion: ${aplicadas.length}\n`)
await concederPermisosDeAplicacion(admin, { ...admin, user: USUARIO_APP })
await informar(admin)
