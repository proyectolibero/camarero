/**
 * Latido del borde: mantiene despierta la base de Supabase.
 *
 * Supabase Free pausa el proyecto tras siete dias sin actividad (RISK-001), y despausarlo
 * cuesta la contrasena del rol del borde (RISK-020). El cron diario del Worker hace DOS
 * cosas, porque la pausa se decide por actividad y no esta claro que cuenta como tal:
 *   - una consulta real a Postgres a traves del enlace `BASE` de Hyperdrive, y
 *   - una llamada al endpoint de salud de Auth (`GET /auth/v1/health` con la publishable).
 *
 * El endpoint raiz de PostgREST (`/rest/v1/`) NO sirve: exige una clave secreta que por
 * diseno no tenemos, respondia 401 permanente y el codigo lo contaba como exito (LL-019).
 *
 * Cada sondeo se intenta POR SEPARADO: si uno falla, el otro sigue. Un fallo se registra,
 * nunca se esconde, y jamas tumba el cron: un keep-alive que revienta al primer tropiezo
 * deja de cumplir su unica funcion. La red se inyecta como dependencia para poder probar el
 * manejador sin salir a internet (mismo patron que `panel/proveedor.ts`).
 */
import { Client } from "pg"

/**
 * Un sondeo. Debe resolver SOLO si el destino confirma su salud con una respuesta concreta
 * (un 2xx del endpoint elegido). Cualquier otra respuesta o un error de red es un fallo y se
 * manifiesta lanzando: un sondeo que acepta cualquier respuesta no sondea nada (LL-019).
 */
export type Sondeo = () => Promise<void>

export type DependenciasDeLatido = {
  readonly consultarBase: Sondeo
  readonly llamarApi: Sondeo
  readonly registrar: (mensaje: string) => void
}

export type ResultadoDeLatido = {
  readonly base: "ok" | "fallo"
  readonly api: "ok" | "fallo"
}

/** Entorno minimo del borde necesario para el latido. */
export type EntornoDeLatido = {
  readonly BASE?: { readonly connectionString: string }
  readonly SUPABASE_URL?: string
  readonly SUPABASE_ANON_KEY?: string
}

export type DependenciasParcialesDeLatido = {
  readonly consultarBase?: Sondeo
  readonly llamarApi?: Sondeo
  readonly registrar?: (mensaje: string) => void
}

function describir(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function intentar(
  nombre: string,
  sondeo: Sondeo,
  registrar: (mensaje: string) => void,
): Promise<"ok" | "fallo"> {
  try {
    await sondeo()
    registrar(`keep-alive: ${nombre} respondio`)
    return "ok"
  } catch (error) {
    registrar(`keep-alive: ${nombre} fallo: ${describir(error)}`)
    return "fallo"
  }
}

/** Ejecuta los dos sondeos. Nunca lanza: el cron no debe morir por un fallo de red. */
export async function latido(dependencias: DependenciasDeLatido): Promise<ResultadoDeLatido> {
  const base = await intentar("base", dependencias.consultarBase, dependencias.registrar)
  const api = await intentar("api", dependencias.llamarApi, dependencias.registrar)
  return { base, api }
}

/** Consulta real a Postgres por Hyperdrive. `select 1` basta para constar como actividad. */
export function consultarBase(connectionString: string): Sondeo {
  return async () => {
    const cliente = new Client({ connectionString, connectionTimeoutMillis: 10_000 })
    await cliente.connect()
    try {
      await cliente.query("select 1")
    } finally {
      await cliente.end()
    }
  }
}

/**
 * Llamada al endpoint de salud de Auth. Exige un 2xx: un 401 o un 404 son FALLOS, no exitos.
 *
 * Se eligio `/auth/v1/health` porque ACEPTA la clase de credencial que tenemos (la
 * publishable) y responde 200. El endpoint raiz de PostgREST exige una clave secreta y
 * devolvia 401 ("Secret API key required"), que este codigo contaba como exito (LL-019).
 */
export function llamarApi(urlBase: string, clavePublicable: string): Sondeo {
  const raiz = urlBase.replace(/\/+$/, "")
  return async () => {
    const respuesta = await fetch(`${raiz}/auth/v1/health`, {
      headers: { apikey: clavePublicable },
    })
    if (!respuesta.ok) {
      throw new Error(`la API de salud respondio ${respuesta.status}`)
    }
  }
}

/** Sondeo de base que falla con un motivo claro si falta el enlace, en vez de no hacer nada. */
function sondeoDeBase(entorno: EntornoDeLatido): Sondeo {
  const base = entorno.BASE
  if (base === undefined) {
    return async () => {
      throw new Error("falta el enlace BASE de Hyperdrive")
    }
  }
  return consultarBase(base.connectionString)
}

/** Sondeo de la API que falla con un motivo claro si falta configuracion. */
function sondeoDeApi(entorno: EntornoDeLatido): Sondeo {
  const url = entorno.SUPABASE_URL
  const clave = entorno.SUPABASE_ANON_KEY
  if (url === undefined || url === "" || clave === undefined || clave === "") {
    return async () => {
      throw new Error("faltan SUPABASE_URL o SUPABASE_ANON_KEY")
    }
  }
  return llamarApi(url, clave)
}

/**
 * Punto de entrada del cron. Construye los sondeos reales a partir del entorno y permite
 * sustituirlos en las pruebas para no tocar la red ni la base.
 */
export async function manejarLatido(
  entorno: EntornoDeLatido,
  parciales: DependenciasParcialesDeLatido = {},
): Promise<ResultadoDeLatido> {
  return latido({
    consultarBase: parciales.consultarBase ?? sondeoDeBase(entorno),
    llamarApi: parciales.llamarApi ?? sondeoDeApi(entorno),
    registrar: parciales.registrar ?? ((mensaje) => console.log(mensaje)),
  })
}
