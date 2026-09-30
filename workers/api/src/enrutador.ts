/**
 * Enrutador del borde.
 *
 * Recibe la peticion, el entorno (variables y enlaces) y la hora. Verifica el pasaporte de
 * Supabase contra sus claves publicas y, a traves de Hyperdrive, resuelve la ficha del
 * empleado. La hora se pasa como parametro para poder probar la caducidad sin depender del
 * reloj real, y todo lo que sale a la red (claves, autenticacion, resolucion de la ficha) se
 * inyecta como dependencia para poder probar sin salir a la red.
 */
import {
  type ClaveDeFirma,
  cargarClavesDeFirma,
  type FuenteDeClaves,
  IdentidadNoDisponible,
  verificarConClaves,
} from "./auth/jwks.ts"
import type { Reclamaciones } from "./auth/jwt.ts"
import { type Empleado, resolverSesion } from "./base.ts"
import { type AlmacenPanel, almacenDeEntorno } from "./panel/datos.ts"
import {
  type Autenticador,
  autenticadorDeEntorno,
  type Dependencias,
  type ResolvedorDeEmpleado,
} from "./panel/proveedor.ts"
import { manejarPanel } from "./panel/rutas.ts"
import {
  responderError,
  responderMetodoNoPermitido,
  responderNoEncontrado,
  responderSalud,
  respuestaJson,
} from "./salud.ts"

export type { FuenteDeClaves } from "./auth/jwks.ts"

/** Variables y enlaces del Worker. `SUPABASE_ANON_KEY` es un secreto del Worker, no del repo. */
export type Entorno = {
  readonly VERSION?: string
  readonly SUPABASE_URL?: string
  readonly SUPABASE_ANON_KEY?: string
  readonly DOMINIO_PUBLICO?: string
  readonly BASE?: { readonly connectionString: string }
}

/** Lo que las pruebas pueden sustituir para no salir a la red ni tocar la base. */
export type DependenciasParciales = {
  readonly fuenteDeClaves?: FuenteDeClaves
  readonly autenticar?: Autenticador
  readonly resolverEmpleado?: ResolvedorDeEmpleado
  readonly almacen?: AlmacenPanel
}

const VERSION_POR_DEFECTO = "desconocida"

function tokenDelEncabezado(peticion: Request): string | null {
  const autorizacion = peticion.headers.get("authorization") ?? ""
  if (!autorizacion.startsWith("Bearer ")) {
    return null
  }
  return autorizacion.slice("Bearer ".length)
}

function resolverEmpleadoPorDefecto(entorno: Entorno, sub: string): Promise<Empleado | null> {
  const base = entorno.BASE
  if (base === undefined) {
    return Promise.resolve(null)
  }
  return resolverSesion(base.connectionString, sub)
}

function crearDependencias(entorno: Entorno, parciales: DependenciasParciales): Dependencias {
  return {
    fuenteDeClaves: parciales.fuenteDeClaves ?? cargarClavesDeFirma,
    autenticar: parciales.autenticar ?? autenticadorDeEntorno(entorno),
    resolverEmpleado:
      parciales.resolverEmpleado ?? ((sub) => resolverEmpleadoPorDefecto(entorno, sub)),
    almacen: parciales.almacen ?? almacenDeEntorno(entorno),
  }
}

async function manejarSesion(
  peticion: Request,
  entorno: Entorno,
  ahora: Date,
  fuente: FuenteDeClaves,
): Promise<Response> {
  if (entorno.SUPABASE_URL === undefined || entorno.BASE === undefined) {
    return responderError(503, "servicio_no_configurado")
  }
  const token = tokenDelEncabezado(peticion)
  if (token === null) {
    return responderError(401, "falta_token")
  }
  let claves: readonly ClaveDeFirma[]
  try {
    claves = await fuente(entorno.SUPABASE_URL, ahora.getTime())
  } catch (error) {
    if (error instanceof IdentidadNoDisponible) {
      // No sabemos validar pasaportes ahora mismo. No es que este token sea malo: es que no
      // podemos juzgarlo, y eso no se le achaca a quien llama con un 401.
      return responderError(503, "identidad_no_disponible")
    }
    throw error
  }
  let reclamaciones: Reclamaciones
  try {
    reclamaciones = await verificarConClaves(token, claves, Math.floor(ahora.getTime() / 1000))
  } catch {
    // Caducado, firma invalida o mal formado: para quien llama es lo mismo, no entra.
    return responderError(401, "token_invalido")
  }
  const empleado = await resolverSesion(entorno.BASE.connectionString, reclamaciones.sub)
  if (empleado === null) {
    return responderError(403, "empleado_no_vinculado")
  }
  return respuestaJson({ estado: "ok", empleado }, 200)
}

export async function manejar(
  peticion: Request,
  entorno: Entorno,
  ahora: Date,
  dependencias: DependenciasParciales = {},
): Promise<Response> {
  const url = new URL(peticion.url)

  if (url.pathname === "/health") {
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido()
    }
    return responderSalud(ahora, entorno.VERSION ?? VERSION_POR_DEFECTO)
  }

  const completas = crearDependencias(entorno, dependencias)

  if (url.pathname === "/auth/sesion") {
    if (peticion.method !== "POST") {
      return responderMetodoNoPermitido("POST")
    }
    return await manejarSesion(peticion, entorno, ahora, completas.fuenteDeClaves)
  }

  const respuestaPanel = await manejarPanel(peticion, entorno, ahora, completas)
  if (respuestaPanel !== null) {
    return respuestaPanel
  }

  return responderNoEncontrado()
}
