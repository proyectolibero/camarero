/**
 * La sala: todas las mesas del local, sus comandas y sus estados (`GET /admin/sala`), y el
 * detalle de una mesa con sus comandas (`GET /admin/sala/<mesaId>`) (D-053).
 *
 * La sala NO se filtra por puesto: es la vista completa del salon. Se dibuja en el servidor,
 * sin JavaScript, con `<meta http-equiv="refresh">`, y NUNCA muestra importes. La cerradura de
 * aislamiento es la RLS: si un empleado de otro local fuerza la peticion, la base no le da
 * filas. Anular una comanda es un POST que respeta la maquina de `CONTRACT-estados-comanda`.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenPanel, MotivoDeCambioComanda } from "./datos.ts"
import { puedeOperarCocina } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import {
  type EstadoPantalla,
  vistaAviso,
  vistaDetalleMesa,
  vistaEntrada,
  vistaSala,
  vistaSinPermiso,
} from "./vistas.ts"

/** Cada causa de fallo al anular tiene su mensaje: un fallo sin explicar es un fallo invisible. */
const MENSAJE_DE_ANULACION: Readonly<Record<MotivoDeCambioComanda, string>> = {
  sin_permiso: "No tienes permiso para anular esa comanda.",
  no_existe: "Esa comanda ya no existe o no es de tu local.",
  transicion_invalida: "Esa comanda ya no se puede anular.",
}

async function renderSala(
  empleado: Empleado,
  almacen: AlmacenPanel,
  estado: EstadoPantalla & { readonly aprobada?: boolean },
): Promise<Response> {
  const resumenes = await almacen.listarSala(empleado)
  return respuestaHtml(
    renderizar(vistaSala(empleado, resumenes, estado)),
    estado.estadoError ?? 200,
  )
}

async function mostrarSala(url: URL, empleado: Empleado, almacen: AlmacenPanel): Promise<Response> {
  return await renderSala(empleado, almacen, {
    aprobada: url.searchParams.get("aprobada") === "1",
  })
}

async function renderDetalle(
  empleado: Empleado,
  mesaId: string,
  almacen: AlmacenPanel,
  estado: EstadoPantalla & { readonly anulada?: boolean },
): Promise<Response> {
  const resumenes = await almacen.listarSala(empleado)
  const resumen = resumenes.find((candidato) => candidato.mesa.id === mesaId)
  if (resumen === undefined) {
    const aviso = vistaAviso(
      empleado,
      "Mesa no encontrada",
      "Esa mesa no existe o no es de un local que puedas ver.",
    )
    return respuestaHtml(renderizar(aviso), 404)
  }
  const comandas = await almacen.listarComandasDeMesa(empleado, mesaId)
  return respuestaHtml(
    renderizar(vistaDetalleMesa(empleado, resumen, comandas, estado)),
    estado.estadoError ?? 200,
  )
}

async function anularComanda(
  empleado: Empleado,
  mesaId: string,
  comandaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  const resultado = await almacen.cambiarEstadoComanda(empleado, comandaId, "anulada")
  if (!resultado.ok) {
    return await renderDetalle(empleado, mesaId, almacen, {
      error: MENSAJE_DE_ANULACION[resultado.motivo],
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 409,
    })
  }
  return responderRedireccion(`/admin/sala/${encodeURIComponent(mesaId)}?anulada=1`)
}

/** Devuelve la respuesta de la sala, o null si la ruta no es la de la sala. */
export async function manejarSala(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const segmentos = url.pathname.split("/").filter((trozo) => trozo !== "")
  if (segmentos[0] !== "admin" || segmentos[1] !== "sala") {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), peticion.method === "GET" ? 200 : 401)
  }
  if (!puedeOperarCocina(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "ver la sala")), 403)
  }
  const almacen = dependencias.almacen
  if (segmentos.length === 2) {
    return peticion.method === "GET"
      ? await mostrarSala(url, empleado, almacen)
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 3) {
    const mesaId = segmentos[2]
    if (mesaId === undefined) {
      return responderNoEncontrado()
    }
    return peticion.method === "GET"
      ? await renderDetalle(empleado, mesaId, almacen, {})
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 6 && segmentos[3] === "comandas" && segmentos[5] === "anular") {
    const mesaId = segmentos[2]
    const comandaId = segmentos[4]
    if (mesaId === undefined || comandaId === undefined) {
      return responderNoEncontrado()
    }
    return peticion.method === "POST"
      ? await anularComanda(empleado, mesaId, comandaId, almacen)
      : responderMetodoNoPermitido("POST")
  }
  return responderNoEncontrado()
}
