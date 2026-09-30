/**
 * SIEMBRA UN EMPLEADO DE PRUEBA (FIXTURE).
 *
 * ESTO NO ES EL ALTA DE LOCALES. El alta real (con sus validaciones, permisos y auditoria)
 * se construye en la Fase 1. Este script existe solo para disponer de datos con los que
 * probar el inicio de sesion del panel contra un Postgres real: crea una organizacion, un
 * local y una ficha de empleado ya enlazada con un usuario de Supabase Auth que debe
 * existir de antemano.
 *
 * Se conecta como ADMINISTRACION (CAMARERO_DB_URL_ADMIN + CAMARERO_DB_PASSWORD_ADMIN) y
 * confia en la CA publica de Supabase; NUNCA desactiva la verificacion TLS. Imprime solo
 * identificadores: jamas credenciales.
 *
 * Es idempotente: si la organizacion, el local o la ficha ya existen para este correo, los
 * reutiliza en lugar de duplicarlos.
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

// Certificado raiz PUBLICO de Supabase, incluido para no desactivar la verificacion.
const RUTA_CA_POR_DEFECTO = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))

const EMAIL_POR_DEFECTO = "dueno@prueba.test"
const NOMBRE_ORG = "Local de prueba"
const SLUG_LOCAL = "local-de-prueba"
const NOMBRE_EMPLEADO = "Dueño de prueba"
const ROL_EMPLEADO = "org_owner"

type FilaStaff = { id: string; org_id: string; location_id: string | null }

async function leerAutoridadCertificadora(): Promise<string> {
  return readFile(process.env.CAMARERO_DB_CA ?? RUTA_CA_POR_DEFECTO, "utf8")
}

function parametrosDesdeUrl(
  url: string,
  ca: string,
  contrasenaSeparada?: string,
): ParametrosConexion {
  const partes = new URL(url)
  const usuario = decodeURIComponent(partes.username)
  // La contrasena en su propio secreto evita el baile de codificarla dentro de una URL.
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

function leerEmail(): string {
  const valor = process.env.CAMARERO_EMPLEADO_EMAIL
  return valor === undefined || valor.trim() === "" ? EMAIL_POR_DEFECTO : valor.trim()
}

function esErrorConCodigo(error: unknown): error is { code: string } {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false
  }
  return typeof (error as { code?: unknown }).code === "string"
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * El usuario de Supabase Auth debe existir antes: un escaneo no crea cuentas. Si el
 * administrador no puede leer `auth.users` (42501), se para y se reporta el error literal,
 * porque el UUID habria que copiarlo a mano desde el panel.
 */
async function buscarUsuarioDeAuth(admin: ParametrosConexion, email: string): Promise<string> {
  const cliente = await conectar(admin)
  try {
    const resultado = await cliente.query<{ id: string }>(
      "select id from auth.users where email = $1",
      [email],
    )
    const id = resultado.rows[0]?.id
    if (id === undefined) {
      throw new Error(
        `No existe ningun usuario en auth.users con el correo ${email}: crealo en el panel de Supabase antes de sembrar.`,
      )
    }
    return id
  } catch (error) {
    if (esErrorConCodigo(error) && error.code === "42501") {
      throw new Error(
        `El administrador no puede leer auth.users (permiso denegado, 42501). Habria que copiar el UUID a mano desde el panel de Supabase. Error literal: ${mensajeDeError(error)}`,
      )
    }
    throw error
  } finally {
    await cerrar(cliente)
  }
}

async function buscarStaff(cliente: ClientePostgres, email: string): Promise<FilaStaff | null> {
  const resultado = await cliente.query<FilaStaff>(
    "select id, org_id, location_id from public.staff where email = $1 order by created_at limit 1",
    [email],
  )
  return resultado.rows[0] ?? null
}

async function asegurarOrganizacion(
  cliente: ClientePostgres,
  existente: string | null,
): Promise<string> {
  if (existente !== null) {
    return existente
  }
  const previa = await cliente.query<{ id: string }>(
    "select id from public.orgs where name = $1 order by created_at limit 1",
    [NOMBRE_ORG],
  )
  if (previa.rows[0] !== undefined) {
    return previa.rows[0].id
  }
  const creada = await cliente.query<{ id: string }>(
    "insert into public.orgs (name) values ($1) returning id",
    [NOMBRE_ORG],
  )
  const id = creada.rows[0]?.id
  if (id === undefined) {
    throw new Error("La insercion de la organizacion no devolvio identificador")
  }
  return id
}

async function asegurarLocal(
  cliente: ClientePostgres,
  orgId: string,
  existente: string | null,
): Promise<string> {
  if (existente !== null) {
    return existente
  }
  const previo = await cliente.query<{ id: string }>(
    "select id from public.locations where org_id = $1 and slug = $2",
    [orgId, SLUG_LOCAL],
  )
  if (previo.rows[0] !== undefined) {
    return previo.rows[0].id
  }
  const creado = await cliente.query<{ id: string }>(
    `insert into public.locations (org_id, slug, name, status)
     values ($1, $2, $3, 'active')
     returning id`,
    [orgId, SLUG_LOCAL, NOMBRE_ORG],
  )
  const id = creado.rows[0]?.id
  if (id === undefined) {
    throw new Error("La insercion del local no devolvio identificador")
  }
  return id
}

type DatosEmpleado = {
  orgId: string
  locationId: string
  email: string
  authUserId: string
  staffId: string | null
}

async function asegurarEmpleado(cliente: ClientePostgres, datos: DatosEmpleado): Promise<string> {
  if (datos.staffId !== null) {
    await cliente.query(
      `update public.staff set auth_user_id = $2, location_id = $3
       where id = $1 and (auth_user_id is distinct from $2 or location_id is distinct from $3)`,
      [datos.staffId, datos.authUserId, datos.locationId],
    )
    return datos.staffId
  }
  const creado = await cliente.query<{ id: string }>(
    `insert into public.staff (org_id, location_id, email, display_name, role, auth_user_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (org_id, email) do update
       set auth_user_id = excluded.auth_user_id, location_id = excluded.location_id
     returning id`,
    [datos.orgId, datos.locationId, datos.email, NOMBRE_EMPLEADO, ROL_EMPLEADO, datos.authUserId],
  )
  const id = creado.rows[0]?.id
  if (id === undefined) {
    throw new Error("La insercion de la ficha de empleado no devolvio identificador")
  }
  return id
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

const email = leerEmail()
const admin = parametrosDesdeUrl(url, await leerAutoridadCertificadora(), contrasena)
const authUserId = await buscarUsuarioDeAuth(admin, email)

const cliente = await conectar(admin)
try {
  const previo = await buscarStaff(cliente, email)
  const orgId = await asegurarOrganizacion(cliente, previo?.org_id ?? null)
  const locationId = await asegurarLocal(cliente, orgId, previo?.location_id ?? null)
  const staffId = await asegurarEmpleado(cliente, {
    orgId,
    locationId,
    email,
    authUserId,
    staffId: previo?.id ?? null,
  })
  process.stdout.write(`Organizacion: ${orgId}\n`)
  process.stdout.write(`Local: ${locationId}\n`)
  process.stdout.write(`Empleado: ${staffId}\n`)
  process.stdout.write(`Usuario de Supabase: ${authUserId}\n`)
} finally {
  await cerrar(cliente)
}
