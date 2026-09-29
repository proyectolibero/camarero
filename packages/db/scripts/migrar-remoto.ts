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

/**
 * Usuario con el que se conecta un rol a traves del pooler: el formato es
 * `<rol>.<referencia del proyecto>`. Se deriva del usuario administrador para no pedir un
 * secreto mas.
 */
function usuarioDelRol(usuarioActual: string, rol: string): string {
  const punto = usuarioActual.indexOf(".")
  return punto === -1 ? rol : `${rol}${usuarioActual.slice(punto)}`
}

/**
 * Prueba de aislamiento contra la base de verdad: se crea una organizacion, se comprueba que
 * el rol de la aplicacion NO la ve sin contexto, y se borra. Si la app viera esa fila, la RLS
 * no estaria haciendo su trabajo y habria que parar.
 */
async function comprobarAislamiento(
  admin: ParametrosConexion,
  contrasenaApp: string,
): Promise<void> {
  const orgDePrueba = "00000000-0000-0000-0000-00000000f0f0"
  const comoAdmin = await conectar(admin)
  try {
    await comoAdmin.query(
      "insert into public.orgs (id, name) values ($1, $2) on conflict (id) do nothing",
      [orgDePrueba, "comprobacion de aislamiento"],
    )
  } finally {
    await cerrar(comoAdmin)
  }

  const app: ParametrosConexion = {
    ...admin,
    user: usuarioDelRol(admin.user, USUARIO_APP),
    password: contrasenaApp,
  }
  const comoApp = await conectar(app)
  let filasVistas = -1
  try {
    filasVistas = await contar(comoApp, "select count(*)::int as n from public.orgs")
  } finally {
    await cerrar(comoApp)
  }

  const limpieza = await conectar(admin)
  try {
    await limpieza.query("delete from public.orgs where id = $1", [orgDePrueba])
  } finally {
    await cerrar(limpieza)
  }

  process.stdout.write(
    `Aislamiento: filas que ve el rol de la app sin contexto: ${filasVistas} (esperado 0)\n`,
  )
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

const contrasenaApp = leerContrasenaDeLaApp()
await asegurarRolDeAplicacion(admin, USUARIO_APP, contrasenaApp)
const aplicadas = await aplicarMigraciones(admin, undefined, { registro: REGISTRO })
process.stdout.write(`Migraciones aplicadas en esta ejecucion: ${aplicadas.length}\n`)
await concederPermisosDeAplicacion(admin, { ...admin, user: USUARIO_APP })
if (contrasenaApp !== null) {
  await comprobarAislamiento(admin, contrasenaApp)
}
await informar(admin)
