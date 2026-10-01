/**
 * La cocina: las comandas del local (`GET /admin/pedidos`).
 *
 * Se dibuja en el servidor y sin JavaScript. Se refresca a mano con `<meta http-equiv="refresh">`,
 * declarado a proposito. Aceptar cierra los importes en la base; anular y marcar lista son
 * cambios de estado que respetan la maquina de `CONTRACT-estados-comanda` (nunca `cerrada`,
 * que exige un cobro previo). La cerradura de aislamiento es la RLS: la pantalla solo decide
 * que se dibuja; si un empleado de otro local fuerza la peticion, la base no le da filas.
 */
import { type EstadoDeComanda, esEstadoDeComanda } from "@camarero/domain"
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenPanel, MotivoDeCambioComanda } from "./datos.ts"
import { puedeOperarCocina } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import { type EstadoPantalla, vistaCocina, vistaEntrada, vistaSinPermiso } from "./vistas.ts"

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

async function primerCampo(peticion: Request, clave: string): Promise<string> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return ""
  }
  return (new URLSearchParams(await peticion.text()).get(clave) ?? "").trim()
}

async function renderCocina(
  empleado: Empleado,
  almacen: AlmacenPanel,
  estado: EstadoPantalla,
): Promise<Response> {
  const comandas = await almacen.listarComandas(empleado)
  return respuestaHtml(
    renderizar(vistaCocina(empleado, comandas, estado)),
    estado.estadoError ?? 200,
  )
}

async function mostrarCocina(
  url: URL,
  empleado: Empleado,
  almacen: AlmacenPanel,
): Promise<Response> {
  const cambiado = url.searchParams.get("cambiado") === "1"
  return await renderCocina(empleado, almacen, cambiado ? { exito: "Comanda actualizada." } : {})
}

async function cambiarEstado(
  peticion: Request,
  empleado: Empleado,
  comandaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  const destino = await primerCampo(peticion, "destino")
  if (!esEstadoDeComanda(destino) || !DESTINOS_DE_COCINA.has(destino)) {
    return await renderCocina(empleado, almacen, {
      error: "Ese estado no se puede aplicar desde cocina.",
      estadoError: 400,
    })
  }
  const resultado = await almacen.cambiarEstadoComanda(empleado, comandaId, destino)
  if (!resultado.ok) {
    return await renderCocina(empleado, almacen, {
      error: MENSAJE_DE_CAMBIO[resultado.motivo],
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 409,
    })
  }
  return responderRedireccion("/admin/pedidos?cambiado=1")
}

/** Devuelve la respuesta de la cocina, o null si la ruta no es la de pedidos. */
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
  if (segmentos.length === 2) {
    return peticion.method === "GET"
      ? await mostrarCocina(url, empleado, dependencias.almacen)
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 4 && segmentos[3] === "estado" && segmentos[2] !== undefined) {
    return peticion.method === "POST"
      ? await cambiarEstado(peticion, empleado, segmentos[2], dependencias.almacen)
      : responderMetodoNoPermitido("POST")
  }
  return responderNoEncontrado()
}
