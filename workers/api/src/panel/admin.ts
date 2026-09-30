/**
 * Rutas de gestion del panel del local (`/admin/local`, zonas, mesas y QR).
 *
 * Toda mutacion entra por POST y vuelve con una redireccion (PRG), como manda el armazon.
 * La pantalla solo decide que se dibuja: si alguien fuerza un POST sin permiso, la RLS de
 * Postgres es la que rechaza la escritura. Aqui se comprueba igual para dar un 403 claro en
 * lugar de un cambio silencioso de cero filas.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenPanel, CambiosLocal } from "./datos.ts"
import { puedeEditarLocal } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import {
  type Validacion,
  validarEstado,
  validarModoDeServicio,
  validarNombre,
  validarZonaHoraria,
  valido,
} from "./validacion.ts"
import { vistaEntrada, vistaLocal, vistaSinLocal, vistaSinPermiso } from "./vistas.ts"

/** Lee un formulario urlencoded como pares clave-valor. Un cuerpo que no vale es un mapa vacio. */
async function leerCampos(peticion: Request): Promise<Readonly<Record<string, string>>> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return {}
  }
  const campos: Record<string, string> = {}
  for (const [clave, valor] of new URLSearchParams(await peticion.text())) {
    campos[clave] = valor
  }
  return campos
}

function validarCambiosLocal(campos: Readonly<Record<string, string>>): Validacion<CambiosLocal> {
  const nombre = validarNombre("nombre del local", campos["nombre"] ?? "")
  if (!nombre.ok) {
    return nombre
  }
  const timezone = validarZonaHoraria(campos["zona_horaria"] ?? "")
  if (!timezone.ok) {
    return timezone
  }
  const status = validarEstado(campos["estado"] ?? "")
  if (!status.ok) {
    return status
  }
  const serviceMode = validarModoDeServicio(campos["modo_servicio"] ?? "")
  if (!serviceMode.ok) {
    return serviceMode
  }
  return valido({
    nombre: nombre.valor,
    timezone: timezone.valor,
    status: status.valor,
    serviceMode: serviceMode.valor,
  })
}

async function mostrarLocal(
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  const local = await almacen.leerLocal(empleado)
  if (local === null) {
    return respuestaHtml(renderizar(vistaSinLocal(empleado)), 200)
  }
  const guardado = url.searchParams.get("guardado") === "1"
  return respuestaHtml(
    renderizar(vistaLocal(empleado, local, puedeEditarLocal(empleado), guardado)),
  )
}

async function guardarLocal(
  peticion: Request,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  if (!puedeEditarLocal(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "editar los datos del local")), 403)
  }
  const cambios = validarCambiosLocal(await leerCampos(peticion))
  if (!cambios.ok) {
    const actual = await almacen.leerLocal(empleado)
    if (actual === null) {
      return respuestaHtml(renderizar(vistaSinLocal(empleado)), 200)
    }
    const vista = vistaLocal(empleado, actual, true, false, cambios.error)
    return respuestaHtml(renderizar(vista), 400)
  }
  const resultado = await almacen.actualizarLocal(empleado, cambios.valor)
  if (!resultado.ok) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "editar los datos del local")), 403)
  }
  return responderRedireccion("/admin/local?guardado=1")
}

async function rutaLocal(
  peticion: Request,
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (peticion.method === "GET") {
    return await mostrarLocal(url, empleado, almacen)
  }
  if (peticion.method === "POST") {
    return await guardarLocal(peticion, empleado, almacen)
  }
  return responderMetodoNoPermitido("GET, POST")
}

/** Devuelve la respuesta de una ruta de gestion, o null si no es del panel del local. */
export async function manejarAdmin(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  if (url.pathname !== "/admin/local") {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  return await rutaLocal(peticion, url, empleado, dependencias.almacen)
}
