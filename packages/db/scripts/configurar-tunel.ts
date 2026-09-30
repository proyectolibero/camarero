/**
 * Crea (o actualiza) el tunel de Hyperdrive hacia Supabase, confiando en su CA.
 *
 * Se ejecuta en el flujo "Configurar tunel" con las llaves ya guardadas. NUNCA imprime la
 * cadena de conexion ni la contrasena: solo los identificadores, que no son secretos.
 *
 * Por que hay que subir la CA: Supabase firma con una raiz propia (autofirmada), asi que el
 * modo por defecto de Hyperdrive (`require`, que valida contra las raices publicas) no le
 * vale. Con la CA subida se usa `verify-full`, que SI comprueba el certificado. Se usa la
 * conexion DIRECTA de Supabase (Hyperdrive vive en Cloudflare, que si tiene IPv6) y el rol
 * de la aplicacion, que no puede saltarse la RLS.
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { USUARIO_APP } from "../src/configuracion.ts"

const API = "https://api.cloudflare.com/client/v4"
const RUTA_CA = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))
const NOMBRE_CA = "supabase-root-2021"
const NOMBRE_TUNEL = "camarero-db"
const MODO_TLS = "verify-full"

function requerido(nombre: string): string {
  const valor = process.env[nombre]
  if (valor === undefined || valor === "") {
    throw new Error(`Falta la variable ${nombre}`)
  }
  return valor
}

type Respuesta = { readonly result?: unknown; readonly errors?: Array<{ message?: string }> }

async function api(ruta: string, init?: RequestInit): Promise<unknown> {
  const token = requerido("CLOUDFLARE_API_TOKEN")
  const respuesta = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const cuerpo = (await respuesta.json()) as Respuesta
  if (!respuesta.ok) {
    // Solo el mensaje de error: el cuerpo entero podria llevar datos de la peticion.
    const detalle = cuerpo.errors?.map((e) => e.message ?? "error").join("; ") ?? "sin detalle"
    throw new Error(`Cloudflare respondio ${respuesta.status}: ${detalle}`)
  }
  return cuerpo.result
}

function identificadorDe(resultado: unknown, nombre: string): string {
  const id = (resultado as { id?: unknown } | null)?.id
  if (typeof id !== "string") {
    throw new Error(`No se pudo leer el identificador de ${nombre}`)
  }
  return id
}

/** Sube la CA si no esta ya subida; si lo esta, reutiliza la que hay con ese nombre. */
async function asegurarCa(contenido: string, cuenta: string): Promise<string> {
  const lista = (await api(`/accounts/${cuenta}/mtls_certificates`)) as
    | Array<{ id?: string; name?: string }>
    | undefined
  const existente = lista?.find((certificado) => certificado.name === NOMBRE_CA)
  if (typeof existente?.id === "string") {
    return existente.id
  }
  const creada = await api(`/accounts/${cuenta}/mtls_certificates`, {
    method: "POST",
    body: JSON.stringify({ ca: true, name: NOMBRE_CA, certificates: contenido }),
  })
  return identificadorDe(creada, "la CA")
}

type Origen = {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly user: string
}

async function asegurarTunel(cuenta: string, origen: Origen, caId: string): Promise<string> {
  const configuracion = {
    name: NOMBRE_TUNEL,
    origin: {
      scheme: "postgres",
      host: origen.host,
      port: origen.port,
      database: origen.database,
      user: origen.user,
      password: requerido("CAMARERO_DB_PASSWORD_APP"),
    },
    mtls: { ca_certificate_id: caId, sslmode: MODO_TLS },
    // Sin cache: las lecturas dependen del contexto de identidad, y una respuesta cacheada de
    // un local podria servirse a otro.
    caching: { disabled: true },
  }
  const existentes = (await api(`/accounts/${cuenta}/hyperdrive/configs`)) as
    | Array<{ id?: string; name?: string }>
    | undefined
  const existente = existentes?.find((config) => config.name === NOMBRE_TUNEL)
  if (typeof existente?.id === "string") {
    await api(`/accounts/${cuenta}/hyperdrive/configs/${existente.id}`, {
      method: "PUT",
      body: JSON.stringify(configuracion),
    })
    return existente.id
  }
  const creada = await api(`/accounts/${cuenta}/hyperdrive/configs`, {
    method: "POST",
    body: JSON.stringify(configuracion),
  })
  return identificadorDe(creada, "el tunel")
}

/** De la referencia del proyecto sale el host de la conexion directa de Supabase. */
function hostDirecto(usuarioAdministrador: string): { ref: string; host: string } {
  const punto = usuarioAdministrador.indexOf(".")
  if (punto === -1) {
    throw new Error("El usuario de administracion deberia ser postgres.<referencia>")
  }
  const ref = usuarioAdministrador.slice(punto + 1)
  return { ref, host: `db.${ref}.supabase.co` }
}

const cuenta = requerido("CLOUDFLARE_ACCOUNT_ID")
const urlAdministrador = new URL(requerido("CAMARERO_DB_URL_ADMIN"))
const { ref, host } = hostDirecto(urlAdministrador.username)

const caId = await asegurarCa(await readFile(RUTA_CA, "utf8"), cuenta)
process.stdout.write(`Certificado de autoridad listo: ${caId}\n`)

const tunelId = await asegurarTunel(
  cuenta,
  {
    host,
    port: 5432,
    database: urlAdministrador.pathname.replace(/^\//, "") || "postgres",
    user: USUARIO_APP,
  },
  caId,
)
process.stdout.write(`Tunel listo: ${tunelId}\n`)
process.stdout.write(`Proyecto: ${ref}; modo TLS: ${MODO_TLS}; cache: desactivada\n`)
