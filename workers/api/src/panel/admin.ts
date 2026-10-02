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
import { type HtmlSeguro, renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type {
  AlmacenPanel,
  CambiosLocal,
  Mesa,
  MotivoDeDecision,
  MotivoDeMovimiento,
  NuevaMesa,
  NuevaZona,
  Resultado,
  Zona,
} from "./datos.ts"
import { esDireccion } from "./mapa.ts"
import { puedeEditarLocal, puedeGestionarPlano } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import {
  invalido,
  type Validacion,
  validarAcento,
  validarCapacidad,
  validarClaveDeImagen,
  validarEstado,
  validarModelo,
  validarModoDeServicio,
  validarNombre,
  validarTipoDeMesa,
  validarTipoDeZona,
  validarZonaHoraria,
  valido,
} from "./validacion.ts"
import {
  type EstadoPantalla,
  vistaAviso,
  vistaEntrada,
  vistaLocal,
  vistaMesas,
  vistaParejas,
  vistaQrMesa,
  vistaQrTodas,
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
  const nombre = validarNombre("nombre del local", campos.nombre ?? "")
  if (!nombre.ok) {
    return nombre
  }
  const timezone = validarZonaHoraria(campos.zona_horaria ?? "")
  if (!timezone.ok) {
    return timezone
  }
  const status = validarEstado(campos.estado ?? "")
  if (!status.ok) {
    return status
  }
  const serviceMode = validarModoDeServicio(campos.modo_servicio ?? "")
  if (!serviceMode.ok) {
    return serviceMode
  }
  const modelo = validarModelo(campos.modelo ?? "sobrio")
  if (!modelo.ok) {
    return modelo
  }
  const acento = validarAcento(campos.acento ?? "")
  if (!acento.ok) {
    return acento
  }
  const logo = validarClaveDeImagen(campos.logo ?? "")
  if (!logo.ok) {
    return logo
  }
  const portada = validarClaveDeImagen(campos.portada ?? "")
  if (!portada.ok) {
    return portada
  }
  return valido({
    nombre: nombre.valor,
    timezone: timezone.valor,
    status: status.valor,
    serviceMode: serviceMode.valor,
    modelo: modelo.valor,
    acento: acento.valor,
    logoClave: logo.valor,
    portadaClave: portada.valor,
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
  const nombre = validarNombre("nombre de la zona", campos.nombre ?? "")
  if (!nombre.ok) {
    return nombre
  }
  const kind = validarTipoDeZona(campos.tipo ?? "")
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
  const etiqueta = validarNombre("nombre de la mesa", campos.etiqueta ?? "")
  if (!etiqueta.ok) {
    return etiqueta
  }
  const capacidad = validarCapacidad(campos.capacidad ?? "")
  if (!capacidad.ok) {
    return capacidad
  }
  const kind = validarTipoDeMesa(campos.tipo ?? "mesa")
  if (!kind.ok) {
    return kind
  }
  const zonaId = validarZonaDeLaMesa(campos.zona ?? "", zonas)
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
  estado: EstadoPantalla & {
    readonly creada?: boolean
    readonly cambiada?: boolean
    readonly movida?: boolean
    readonly mesaElegidaId?: string | null
  },
): Promise<Response> {
  const mesas = await almacen.listarMesas(empleado)
  const zonas = await almacen.listarZonas(empleado)
  const vista = vistaMesas(
    empleado,
    mesas,
    zonas,
    puedeGestionarPlano(empleado),
    estado,
    estado.mesaElegidaId ?? null,
  )
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

function mensajeDeMovimiento(motivo: MotivoDeMovimiento): {
  readonly error: string
  readonly estadoError: number
} {
  if (motivo === "ocupada") {
    return {
      error: "Esa casilla ya está ocupada por otra mesa. Muévela primero.",
      estadoError: 409,
    }
  }
  if (motivo === "fuera_de_cuadricula") {
    return {
      error:
        "No se puede mover más allá del borde: la cuadrícula no tiene filas ni columnas negativas.",
      estadoError: 400,
    }
  }
  if (motivo === "sin_permiso") {
    return { error: "No tienes permiso para mover esa mesa.", estadoError: 403 }
  }
  return { error: "Esa mesa ya no existe o no es de tu local.", estadoError: 404 }
}

async function moverMesa(
  peticion: Request,
  empleado: Empleado | null,
  mesaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  if (!puedeGestionarPlano(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "mover mesas")), 403)
  }
  const campos = await leerCampos(peticion)
  const direccion = campos.direccion ?? ""
  if (!esDireccion(direccion)) {
    return await renderMesas(empleado, almacen, {
      error: "Esa dirección no es válida.",
      estadoError: 400,
    })
  }
  const resultado = await almacen.moverMesa(empleado, mesaId, direccion)
  if (!resultado.ok) {
    const fallo = mensajeDeMovimiento(resultado.motivo)
    return await renderMesas(empleado, almacen, {
      error: fallo.error,
      estadoError: fallo.estadoError,
      mesaElegidaId: mesaId,
    })
  }
  // Se conserva la mesa elegida para poder seguir moviendola sin volver a tocar el mapa.
  return responderRedireccion(`/admin/mesas?movida=1&mesa=${encodeURIComponent(mesaId)}`)
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
  // Una mesa sin posicion (anterior a la migracion 0017) se coloca sola en el primer hueco
  // libre y se guarda asi. Es idempotente: con todas colocadas no cambia nada.
  await almacen.acomodarMesasSinPosicion(empleado)
  return await renderMesas(empleado, almacen, {
    creada: url.searchParams.get("creada") === "1",
    cambiada: url.searchParams.get("cambiada") === "1",
    movida: url.searchParams.get("movida") === "1",
    mesaElegidaId: url.searchParams.get("mesa"),
  })
}

// ---------------------------------------------------------------------------
// QR para imprimir
// ---------------------------------------------------------------------------

/** Dominio publico desde la configuracion. null si falta o no es https: no se inventa. */
function dominioDeEntorno(entorno: EntornoDePanel): string | null {
  const dominio = entorno.DOMINIO_PUBLICO?.trim()
  if (dominio === undefined || dominio === "" || !dominio.startsWith("https://")) {
    return null
  }
  return dominio.replace(/\/+$/, "")
}

function contenidoDeMesa(dominio: string, mesa: Mesa): string {
  return `${dominio}/t/${mesa.codigo}`
}

async function rutaQrTodas(
  peticion: Request,
  empleado: Empleado | null,
  entorno: EntornoDePanel,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (peticion.method !== "GET") {
    return responderMetodoNoPermitido("GET")
  }
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  if (!puedeGestionarPlano(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "imprimir los QR")), 403)
  }
  const dominio = dominioDeEntorno(entorno)
  if (dominio === null) {
    return respuestaHtml(renderizar(vistaAvisoSinDominio(empleado)), 503)
  }
  const mesas = await almacen.listarMesas(empleado)
  const vista = vistaQrTodas(empleado, mesas, (mesa) => contenidoDeMesa(dominio, mesa))
  return respuestaHtml(renderizar(vista), 200)
}

async function rutaQrMesa(
  peticion: Request,
  empleado: Empleado | null,
  entorno: EntornoDePanel,
  mesaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (peticion.method !== "GET") {
    return responderMetodoNoPermitido("GET")
  }
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  if (!puedeGestionarPlano(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "imprimir el QR")), 403)
  }
  const dominio = dominioDeEntorno(entorno)
  if (dominio === null) {
    return respuestaHtml(renderizar(vistaAvisoSinDominio(empleado)), 503)
  }
  const mesa = await almacen.leerMesa(empleado, mesaId)
  if (mesa === null) {
    const aviso = vistaAviso(
      empleado,
      "Mesa no encontrada",
      "Esa mesa no existe o no es de un local que puedas gestionar.",
    )
    return respuestaHtml(renderizar(aviso), 404)
  }
  const vista = vistaQrMesa(empleado, mesa, contenidoDeMesa(dominio, mesa))
  return respuestaHtml(renderizar(vista), 200)
}

function vistaAvisoSinDominio(empleado: Empleado): HtmlSeguro {
  return vistaAviso(
    empleado,
    "El QR no está configurado",
    "A esta instalación le falta la variable DOMINIO_PUBLICO. Sin ella, el QR no puede apuntar a la dirección correcta.",
  )
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------

type RutaAdmin =
  | { readonly tipo: "local" }
  | { readonly tipo: "zonas" }
  | { readonly tipo: "mesas" }
  | { readonly tipo: "parejas" }
  | { readonly tipo: "alternar"; readonly mesaId: string }
  | { readonly tipo: "mover"; readonly mesaId: string }
  | { readonly tipo: "qr_todas" }
  | { readonly tipo: "qr_mesa"; readonly mesaId: string }
  | {
      readonly tipo: "pareja_accion"
      readonly solicitudId: string
      readonly decision: "aprobar" | "rechazar"
    }

function reconocerRuta(segmentos: readonly string[]): RutaAdmin | null {
  if (segmentos[0] !== "admin") {
    return null
  }
  if (segmentos.length === 2) {
    const seccion = segmentos[1]
    if (
      seccion === "local" ||
      seccion === "zonas" ||
      seccion === "mesas" ||
      seccion === "parejas"
    ) {
      return { tipo: seccion }
    }
    return null
  }
  if (segmentos.length === 3 && segmentos[1] === "mesas" && segmentos[2] === "qr") {
    return { tipo: "qr_todas" }
  }
  const [, seccion, tercero, cuarto] = segmentos
  if (segmentos.length !== 4 || tercero === undefined) {
    return null
  }
  if (seccion === "parejas" && (cuarto === "aprobar" || cuarto === "rechazar")) {
    return { tipo: "pareja_accion", solicitudId: tercero, decision: cuarto }
  }
  if (seccion !== "mesas") {
    return null
  }
  if (cuarto === "qr") {
    return { tipo: "qr_mesa", mesaId: tercero }
  }
  if (cuarto === "alternar") {
    return { tipo: "alternar", mesaId: tercero }
  }
  if (cuarto === "mover") {
    return { tipo: "mover", mesaId: tercero }
  }
  return null
}

// ---------------------------------------------------------------------------
// Solicitudes de emparejamiento
// ---------------------------------------------------------------------------

async function mostrarParejas(
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  const solicitudes = await almacen.listarParejasPendientes(empleado)
  return respuestaHtml(
    renderizar(
      vistaParejas(empleado, solicitudes, {
        aprobada: url.searchParams.get("aprobada") === "1",
        rechazada: url.searchParams.get("rechazada") === "1",
      }),
    ),
    200,
  )
}

/** Cada causa tiene su mensaje: un cero sin explicar es un cero invisible (LL-024). */
const MENSAJE_DE_DECISION: Readonly<Record<MotivoDeDecision, string>> = {
  sin_permiso: "No tienes permiso para decidir esa solicitud.",
  otro_local: "Esa solicitud no es de tu local o ya no existe.",
  ya_decidida: "Esa solicitud ya se había decidido. Vuelve a mirar la lista.",
  caducada: "Esa solicitud ha caducado: el comensal puede volver a pedirla.",
}

/**
 * Pantallas a las que una decision puede volver. Se aprueba desde la sala y desde cualquier
 * pantalla de puesto, no solo desde el panel de solicitudes (D-053); la lista blanca evita un
 * redirect abierto pero tiene que admitir EXACTAMENTE las rutas que la aplicacion produce:
 * `/admin/sala`, `/admin/sala/<id-de-mesa>` y `/admin/pedidos[/<id-de-puesto>]`, donde el
 * puesto es el UUID que nombro el dueno, no un codigo fijo (H1, LL-024).
 *
 * El valor tiene que ser un `path` relativo (sin esquema ni autoridad) y no puede llevar
 * `?query#fragment`, o se perderia la marca `?aprobada=1` que el manejador anade. El
 * identificador solo lleva caracteres seguros, de modo que no hay inyeccion de cabecera.
 */
const PATRON_DE_RETORNO =
  /^\/admin\/(?:sala(?:\/[0-9A-Za-z._~-]+)?|pedidos(?:\/[0-9A-Za-z._~-]+)?)$/

/** La ruta a la que vuelve una decision, o el panel de solicitudes si no es una reconocida. */
function destinoDeVuelta(valor: string): string {
  return PATRON_DE_RETORNO.test(valor) ? valor : "/admin/parejas"
}

async function decidirPareja(
  peticion: Request,
  empleado: Empleado | null,
  solicitudId: string,
  decision: "aprobar" | "rechazar",
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  // El cuerpo se lee UNA sola vez: motivo y pantalla de vuelta viajan en el mismo formulario.
  const campos = await leerCampos(peticion)
  const motivo = (campos.motivo ?? "").trim() || "No especificado"
  const vuelta = destinoDeVuelta((campos.volver ?? "").trim())
  const resultado =
    decision === "aprobar"
      ? await almacen.aprobarPareja(empleado, solicitudId)
      : await almacen.rechazarPareja(empleado, solicitudId, motivo)
  if (!resultado.ok) {
    const solicitudes = await almacen.listarParejasPendientes(empleado)
    return respuestaHtml(
      renderizar(
        vistaParejas(empleado, solicitudes, { error: MENSAJE_DE_DECISION[resultado.motivo] }),
      ),
      409,
    )
  }
  const marca = decision === "aprobar" ? "aprobada" : "rechazada"
  return responderRedireccion(`${vuelta}?${marca}=1`)
}

async function despachar(
  ruta: RutaAdmin,
  peticion: Request,
  url: URL,
  entorno: EntornoDePanel,
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
    case "mover":
      return peticion.method === "POST"
        ? await moverMesa(peticion, empleado, ruta.mesaId, almacen)
        : responderMetodoNoPermitido("POST")
    case "qr_todas":
      return await rutaQrTodas(peticion, empleado, entorno, almacen)
    case "qr_mesa":
      return await rutaQrMesa(peticion, empleado, entorno, ruta.mesaId, almacen)
    case "parejas":
      return peticion.method === "GET"
        ? await mostrarParejas(url, empleado, almacen)
        : responderMetodoNoPermitido("GET")
    case "pareja_accion":
      return peticion.method === "POST"
        ? await decidirPareja(peticion, empleado, ruta.solicitudId, ruta.decision, almacen)
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
  return await despachar(ruta, peticion, url, entorno, empleado, dependencias.almacen)
}
