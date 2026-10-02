/**
 * Los avisos del comensal en el panel del personal (TASK-F1-13).
 *
 * Dos cosas que el comensal puede pedir desde su movil: que alguien vaya y que la mesa necesita
 * limpieza. Llegan aqui con la mesa y cuanto hace; alguien del local los marca atendidos y
 * desaparecen. Toda mutacion es POST y vuelve con una redireccion (PRG). La cerradura de verdad
 * es la RLS: si un empleado de otro local fuerza el POST, la base no le deja tocar la fila.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenPanel } from "./datos.ts"
import { puedeOperarCocina } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import { vistaAvisos, vistaEntrada, vistaSinPermiso } from "./vistas.ts"

const MENSAJE_DE_ATENCION: Readonly<Record<string, string>> = {
  sin_permiso: "No tienes permiso para atender ese aviso.",
  no_existe: "Ese aviso ya no está pendiente o no es de tu local. Vuelve a mirar la lista.",
  ya_atendido: "Ese aviso ya lo había atendido alguien.",
}

async function mostrarAvisos(
  url: URL,
  empleado: Empleado | null,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 200)
  }
  const avisos = await almacen.listarAvisos(empleado)
  return respuestaHtml(
    renderizar(
      vistaAvisos(empleado, avisos, {
        exito:
          url.searchParams.get("atendido") === "1" ? "Aviso marcado como atendido." : undefined,
      }),
    ),
    200,
  )
}

async function atender(
  empleado: Empleado | null,
  avisoId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), 401)
  }
  if (!puedeOperarCocina(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "atender avisos de las mesas")), 403)
  }
  const resultado = await almacen.atenderAviso(empleado, avisoId)
  if (!resultado.ok) {
    const avisos = await almacen.listarAvisos(empleado)
    return respuestaHtml(
      renderizar(vistaAvisos(empleado, avisos, { error: MENSAJE_DE_ATENCION[resultado.motivo] })),
      409,
    )
  }
  return responderRedireccion("/admin/avisos?atendido=1")
}

/** Devuelve la respuesta de la ruta de avisos, o null si no es suya. */
export async function manejarAvisos(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const partes = url.pathname.split("/").filter((trozo) => trozo !== "")
  if (partes[0] !== "admin" || partes[1] !== "avisos") {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (partes.length === 2) {
    return peticion.method === "GET"
      ? await mostrarAvisos(url, empleado, dependencias.almacen)
      : responderMetodoNoPermitido("GET")
  }
  if (partes.length === 4 && partes[3] === "atender") {
    return peticion.method === "POST"
      ? await atender(empleado, partes[2] ?? "", dependencias.almacen)
      : responderMetodoNoPermitido("POST")
  }
  return null
}
