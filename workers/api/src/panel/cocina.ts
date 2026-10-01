/**
 * Las pantallas de puesto: cocina, barra y todo (`GET /admin/pedidos[/<puesto>]`).
 *
 * Cada dispositivo abre su puesto por RUTA (`/admin/pedidos/cocina`, `/admin/pedidos/barra`,
 * `/admin/pedidos/todo`) para poder dejarlo fijado en la tablet sin tocar nada. Sin puesto,
 * la ruta sirve cocina. Las pantallas se dibujan en el servidor y sin JavaScript, y se
 * refrescan con `<meta http-equiv="refresh">`. NINGUNA muestra precios: quien prepara no cobra.
 *
 * Aceptar cierra los importes en la base; anular y marcar lista son cambios de estado que
 * respetan la maquina de `CONTRACT-estados-comanda` (nunca `cerrada`, que exige un cobro
 * previo). La cerradura de aislamiento es la RLS: la pantalla solo decide que se dibuja; si
 * un empleado de otro local fuerza la peticion, la base no le da filas.
 */
import {
  type EstadoDeComanda,
  esEstadoDeComanda,
  esPuestoDePantalla,
  type PuestoDePantalla,
} from "@camarero/domain"
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenPanel, MotivoDeCambioComanda } from "./datos.ts"
import { puedeOperarCocina } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import { type EstadoPantalla, vistaCocina, vistaEntrada, vistaSinPermiso } from "./vistas.ts"

/** Sin puesto en la ruta se sirve cocina: la tablet de siempre sigue funcionando. */
const PUESTO_POR_DEFECTO: PuestoDePantalla = "cocina"

/** Destinos que el KDS puede escribir: los del contrato menos `cerrada` (exige cobro, F3). */
const DESTINOS_DE_COCINA: ReadonlySet<EstadoDeComanda> = new Set([
  "aceptada",
  "preparando",
  "lista",
  "servida",
  "anulada",
])

/** Cada causa tiene su mensaje: un fallo sin explicar es un fallo invisible. */
const MENSAJE_DE_CAMBIO: Readonly<Record<MotivoDeCambioComanda, string>> = {
  sin_permiso: "No tienes permiso para cambiar esa comanda.",
  no_existe: "Esa comanda ya no existe o no es de tu local.",
  transicion_invalida: "Ese cambio de estado no está permitido para la comanda.",
}

type CamposDeCambio = {
  readonly destino: string
  readonly puesto: PuestoDePantalla
}

function puestoDeTexto(valor: string): PuestoDePantalla {
  return esPuestoDePantalla(valor) ? valor : PUESTO_POR_DEFECTO
}

/** Lee el cuerpo del POST una sola vez: destino y puesto vienen en el mismo formulario. */
async function leerCamposDeCambio(peticion: Request): Promise<CamposDeCambio> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return { destino: "", puesto: PUESTO_POR_DEFECTO }
  }
  const datos = new URLSearchParams(await peticion.text())
  return {
    destino: (datos.get("destino") ?? "").trim(),
    puesto: puestoDeTexto((datos.get("puesto") ?? "").trim()),
  }
}

async function renderCocina(
  empleado: Empleado,
  almacen: AlmacenPanel,
  puesto: PuestoDePantalla,
  estado: EstadoPantalla,
): Promise<Response> {
  const comandas = await almacen.listarComandas(empleado, puesto)
  // Ningun puesto debe recibir pedidos de un comensal sin aprobar: la pantalla de trabajo
  // ensena los emparejamientos pendientes y deja aprobarlos sin salir de aqui (D-053).
  const solicitudes = await almacen.listarParejasPendientes(empleado)
  const avisos = solicitudes.map((solicitud) => ({
    solicitudId: solicitud.id,
    mesa: solicitud.mesa,
  }))
  return respuestaHtml(
    renderizar(vistaCocina(empleado, comandas, puesto, estado, avisos)),
    estado.estadoError ?? 200,
  )
}

async function mostrarCocina(
  url: URL,
  empleado: Empleado,
  almacen: AlmacenPanel,
  puesto: PuestoDePantalla,
): Promise<Response> {
  const exito =
    url.searchParams.get("cambiado") === "1"
      ? "Comanda actualizada."
      : url.searchParams.get("aprobada") === "1"
        ? "Emparejamiento aprobado."
        : undefined
  return await renderCocina(empleado, almacen, puesto, exito === undefined ? {} : { exito })
}

async function cambiarEstado(
  peticion: Request,
  empleado: Empleado,
  comandaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  const { destino, puesto } = await leerCamposDeCambio(peticion)
  if (!esEstadoDeComanda(destino) || !DESTINOS_DE_COCINA.has(destino)) {
    return await renderCocina(empleado, almacen, puesto, {
      error: "Ese estado no se puede aplicar desde cocina.",
      estadoError: 400,
    })
  }
  const resultado = await almacen.cambiarEstadoComanda(empleado, comandaId, destino)
  if (!resultado.ok) {
    return await renderCocina(empleado, almacen, puesto, {
      error: MENSAJE_DE_CAMBIO[resultado.motivo],
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 409,
    })
  }
  return responderRedireccion(`/admin/pedidos/${puesto}?cambiado=1`)
}

async function manejarPantallaDePuesto(
  peticion: Request,
  url: URL,
  empleado: Empleado,
  almacen: AlmacenPanel,
  segmentos: readonly string[],
): Promise<Response> {
  if (segmentos.length === 2) {
    return peticion.method === "GET"
      ? await mostrarCocina(url, empleado, almacen, PUESTO_POR_DEFECTO)
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 3) {
    const puesto = segmentos[2]
    if (puesto === undefined || !esPuestoDePantalla(puesto)) {
      return responderNoEncontrado()
    }
    return peticion.method === "GET"
      ? await mostrarCocina(url, empleado, almacen, puesto)
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 4 && segmentos[3] === "estado") {
    const comandaId = segmentos[2]
    if (comandaId === undefined) {
      return responderNoEncontrado()
    }
    return peticion.method === "POST"
      ? await cambiarEstado(peticion, empleado, comandaId, almacen)
      : responderMetodoNoPermitido("POST")
  }
  return responderNoEncontrado()
}

/** Devuelve la respuesta de un puesto, o null si la ruta no es la de pedidos. */
export async function manejarCocina(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const segmentos = url.pathname.split("/").filter((trozo) => trozo !== "")
  if (segmentos[0] !== "admin" || segmentos[1] !== "pedidos") {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), peticion.method === "GET" ? 200 : 401)
  }
  if (!puedeOperarCocina(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "ver los pedidos")), 403)
  }
  return await manejarPantallaDePuesto(peticion, url, empleado, dependencias.almacen, segmentos)
}
