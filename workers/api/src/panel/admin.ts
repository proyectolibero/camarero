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
import type { AlmacenPanel, CambiosLocal, NuevaMesa, NuevaZona, Resultado, Zona } from "./datos.ts"
import { puedeEditarLocal, puedeGestionarPlano } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import {
  invalido,
  type Validacion,
  validarCapacidad,
  validarEstado,
  validarModoDeServicio,
  validarNombre,
  validarTipoDeMesa,
  validarTipoDeZona,
  validarZonaHoraria,
  valido,
} from "./validacion.ts"
import {
  type EstadoPantalla,
  vistaEntrada,
  vistaLocal,
  vistaMesas,
  vistaSinLocal,
  vistaSinPermiso,
  vistaZonas,
} from "./vistas.ts"

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

function mensajeDeFallo(resultado: Resultado, accion: string): string {
  if (resultado.ok) {
    return ""
  }
  if (resultado.motivo === "conflicto") {
    return `No se pudo ${accion}: ya existe otro registro con ese nombre.`
  }
  if (resultado.motivo === "sin_permiso") {
    return `No tienes permiso para ${accion}.`
  }
  return `No se pudo ${accion}: el local no está disponible.`
}

// ---------------------------------------------------------------------------
// El local
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Zonas
// ---------------------------------------------------------------------------

function validarNuevaZona(campos: Readonly<Record<string, string>>): Validacion<NuevaZona> {
  const nombre = validarNombre("nombre de la zona", campos["nombre"] ?? "")
  if (!nombre.ok) {
    return nombre
  }
  const kind = validarTipoDeZona(campos["tipo"] ?? "")
  if (!kind.ok) {
    return kind
  }
  return valido({ nombre: nombre.valor, kind: kind.valor })
}

async function renderZonas(
  empleado: Empleado,
  almacen: AlmacenPanel,
  estado: EstadoPantalla & { readonly creada?: boolean },
): Promise<Response> {
  const zonas = await almacen.listarZonas(empleado)
  const vista = vistaZonas(empleado, zonas, puedeGestionarPlano(empleado), estado)
  return respuestaHtml(renderizar(vista), estado.estadoError ?? 200)
}

async function crearZona(
  peticion: Request,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  if (!puedeGestionarPlano(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "crear zonas")), 403)
  }
  const nueva = validarNuevaZona(await leerCampos(peticion))
  if (!nueva.ok) {
    return await renderZonas(empleado, almacen, { error: nueva.error, estadoError: 400 })
  }
  const resultado = await almacen.crearZona(empleado, nueva.valor)
  if (!resultado.ok) {
    const estadoError = resultado.motivo === "sin_permiso" ? 403 : 409
    return await renderZonas(empleado, almacen, {
      error: mensajeDeFallo(resultado, "crear la zona"),
      estadoError,
    })
  }
  return responderRedireccion("/admin/zonas?creada=1")
}

async function rutaZonas(
  peticion: Request,
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (peticion.method === "POST") {
    return await crearZona(peticion, empleado, almacen)
  }
  if (peticion.method !== "GET") {
    return responderMetodoNoPermitido("GET, POST")
  }
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  return await renderZonas(empleado, almacen, { creada: url.searchParams.get("creada") === "1" })
}

// ---------------------------------------------------------------------------
// Mesas
// ---------------------------------------------------------------------------

function validarZonaDeLaMesa(valor: string, zonas: readonly Zona[]): Validacion<string | null> {
  if (valor === "") {
    return valido(null)
  }
  return zonas.some((zona) => zona.id === valor)
    ? valido(valor)
    : invalido("Esa zona no existe en tu local.")
}

function validarNuevaMesa(
  campos: Readonly<Record<string, string>>,
  zonas: readonly Zona[],
): Validacion<NuevaMesa> {
  const etiqueta = validarNombre("nombre de la mesa", campos["etiqueta"] ?? "")
  if (!etiqueta.ok) {
    return etiqueta
  }
  const capacidad = validarCapacidad(campos["capacidad"] ?? "")
  if (!capacidad.ok) {
    return capacidad
  }
  const kind = validarTipoDeMesa(campos["tipo"] ?? "mesa")
  if (!kind.ok) {
    return kind
  }
  const zonaId = validarZonaDeLaMesa(campos["zona"] ?? "", zonas)
  if (!zonaId.ok) {
    return zonaId
  }
  return valido({
    etiqueta: etiqueta.valor,
    capacidad: capacidad.valor,
    kind: kind.valor,
    zonaId: zonaId.valor,
  })
}

async function renderMesas(
  empleado: Empleado,
  almacen: AlmacenPanel,
  estado: EstadoPantalla & { readonly creada?: boolean; readonly cambiada?: boolean },
): Promise<Response> {
  const mesas = await almacen.listarMesas(empleado)
  const zonas = await almacen.listarZonas(empleado)
  const vista = vistaMesas(empleado, mesas, zonas, puedeGestionarPlano(empleado), estado)
  return respuestaHtml(renderizar(vista), estado.estadoError ?? 200)
}

async function crearMesa(
  peticion: Request,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  if (!puedeGestionarPlano(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "crear mesas")), 403)
  }
  const zonas = await almacen.listarZonas(empleado)
  const nueva = validarNuevaMesa(await leerCampos(peticion), zonas)
  if (!nueva.ok) {
    return await renderMesas(empleado, almacen, { error: nueva.error, estadoError: 400 })
  }
  const resultado = await almacen.crearMesa(empleado, nueva.valor)
  if (!resultado.ok) {
    const estadoError = resultado.motivo === "sin_permiso" ? 403 : 409
    return await renderMesas(empleado, almacen, {
      error: mensajeDeFallo(resultado, "crear la mesa"),
      estadoError,
    })
  }
  return responderRedireccion("/admin/mesas?creada=1")
}

async function alternarMesa(
  empleado: Empleado | null,
  mesaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  if (!puedeGestionarPlano(empleado)) {
    return respuestaHtml(
      renderizar(vistaSinPermiso(empleado, "cambiar el estado de una mesa")),
      403,
    )
  }
  const resultado = await almacen.alternarMesa(empleado, mesaId)
  if (!resultado.ok) {
    const mensaje =
      resultado.motivo === "sin_permiso"
        ? "No tienes permiso para cambiar esa mesa."
        : "Esa mesa ya no existe o no es de tu local."
    return await renderMesas(empleado, almacen, { error: mensaje, estadoError: 404 })
  }
  return responderRedireccion("/admin/mesas?cambiada=1")
}

async function rutaMesas(
  peticion: Request,
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (peticion.method === "POST") {
    return await crearMesa(peticion, empleado, almacen)
  }
  if (peticion.method !== "GET") {
    return responderMetodoNoPermitido("GET, POST")
  }
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  return await renderMesas(empleado, almacen, {
    creada: url.searchParams.get("creada") === "1",
    cambiada: url.searchParams.get("cambiada") === "1",
  })
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------

type RutaAdmin =
  | { readonly tipo: "local" }
  | { readonly tipo: "zonas" }
  | { readonly tipo: "mesas" }
  | { readonly tipo: "alternar"; readonly mesaId: string }

function reconocerRuta(segmentos: readonly string[]): RutaAdmin | null {
  if (segmentos[0] !== "admin") {
    return null
  }
  if (segmentos.length === 2) {
    const seccion = segmentos[1]
    if (seccion === "local" || seccion === "zonas" || seccion === "mesas") {
      return { tipo: seccion }
    }
    return null
  }
  const [, seccion, tercero, cuarto] = segmentos
  if (
    segmentos.length === 4 &&
    seccion === "mesas" &&
    tercero !== undefined &&
    cuarto === "alternar"
  ) {
    return { tipo: "alternar", mesaId: tercero }
  }
  return null
}

async function despachar(
  ruta: RutaAdmin,
  peticion: Request,
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  switch (ruta.tipo) {
    case "local":
      return await rutaLocal(peticion, url, empleado, almacen)
    case "zonas":
      return await rutaZonas(peticion, url, empleado, almacen)
    case "mesas":
      return await rutaMesas(peticion, url, empleado, almacen)
    case "alternar":
      return peticion.method === "POST"
        ? await alternarMesa(empleado, ruta.mesaId, almacen)
        : responderMetodoNoPermitido("POST")
  }
}

/** Devuelve la respuesta de una ruta de gestion, o null si no es del panel del local. */
export async function manejarAdmin(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const ruta = reconocerRuta(url.pathname.split("/").filter((trozo) => trozo !== ""))
  if (ruta === null) {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  return await despachar(ruta, peticion, url, empleado, dependencias.almacen)
}
