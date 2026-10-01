/**
 * Los puestos del local en el panel del dueno (`/admin/puestos`), TASK-F1-09.
 *
 * El dueno crea, nombra, ordena, activa y desactiva sus puestos, y decide cual nace aceptado.
 * Toda mutacion entra por POST y vuelve con una redireccion (PRG). La pantalla solo decide que
 * se dibuja: la cerradura de verdad es la RLS; aqui se comprueba igual para dar un 403 claro en
 * lugar de un cambio silencioso de cero filas.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { MotivoDeFallo } from "./datos.ts"
import { puedeGestionarCarta } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import { validarNombre } from "./validacion.ts"
import { type EstadoPantalla, vistaEntrada, vistaPuestos, vistaSinPermiso } from "./vistas.ts"

type Campos = Readonly<Record<string, readonly string[]>>

async function leerCampos(peticion: Request): Promise<Campos> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return {}
  }
  const datos = new URLSearchParams(await peticion.text())
  const campos: Record<string, string[]> = {}
  for (const [clave, valor] of datos) {
    const lista = campos[clave]
    if (lista === undefined) {
      campos[clave] = [valor]
    } else {
      lista.push(valor)
    }
  }
  return campos
}

function primer(campos: Campos, clave: string): string {
  return campos[clave]?.[0]?.trim() ?? ""
}

function marcado(campos: Campos, clave: string): boolean {
  return campos[clave] !== undefined
}

function mensajeDeFallo(resultado: { readonly motivo: MotivoDeFallo }, accion: string): string {
  if (resultado.motivo === "conflicto") {
    return `No se pudo ${accion}: ya existe otro puesto con ese nombre en tu local.`
  }
  if (resultado.motivo === "sin_permiso") {
    return `No tienes permiso para ${accion}.`
  }
  return `No se pudo ${accion}: el puesto ya no existe o no es de tu local.`
}

async function renderPuestos(
  empleado: Empleado,
  almacen: Dependencias["almacen"],
  estado: EstadoPantalla & { readonly creado?: boolean },
): Promise<Response> {
  const puestos = await almacen.listarPuestos(empleado)
  const vista = vistaPuestos(empleado, puestos, puedeGestionarCarta(empleado), estado)
  return respuestaHtml(renderizar(vista), estado.estadoError ?? 200)
}

async function crearPuesto(
  peticion: Request,
  empleado: Empleado,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "crear puestos")), 403)
  }
  const campos = await leerCampos(peticion)
  const nombre = validarNombre("nombre del puesto", primer(campos, "nombre"))
  if (!nombre.ok) {
    return await renderPuestos(empleado, almacen, { error: nombre.error, estadoError: 400 })
  }
  const resultado = await almacen.crearPuesto(empleado, {
    nombre: nombre.valor,
    autoAcepta: marcado(campos, "auto_acepta"),
  })
  if (!resultado.ok) {
    return await renderPuestos(empleado, almacen, {
      error: mensajeDeFallo(resultado, "crear el puesto"),
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 409,
    })
  }
  return responderRedireccion("/admin/puestos?creado=1")
}

async function responderCambio(
  resultado: { readonly ok: boolean; readonly motivo?: MotivoDeFallo },
  empleado: Empleado,
  almacen: Dependencias["almacen"],
  accion: string,
): Promise<Response> {
  if (resultado.ok) {
    return responderRedireccion("/admin/puestos?cambiado=1")
  }
  const motivo = resultado.motivo ?? "no_existe"
  const estadoError = motivo === "sin_permiso" ? 403 : motivo === "conflicto" ? 409 : 404
  return await renderPuestos(empleado, almacen, {
    error: mensajeDeFallo({ motivo }, accion),
    estadoError,
  })
}

async function cambiarPuesto(
  peticion: Request,
  empleado: Empleado,
  puestoId: string,
  almacen: Dependencias["almacen"],
  accion: "renombrar" | "mover" | "alternar" | "auto",
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "cambiar los puestos")), 403)
  }
  if (accion === "alternar") {
    return await responderCambio(
      await almacen.alternarPuesto(empleado, puestoId),
      empleado,
      almacen,
      "cambiar el puesto",
    )
  }
  if (accion === "auto") {
    return await responderCambio(
      await almacen.alternarAutoAcepta(empleado, puestoId),
      empleado,
      almacen,
      "cambiar el puesto",
    )
  }
  const campos = await leerCampos(peticion)
  if (accion === "renombrar") {
    const nombre = validarNombre("nombre del puesto", primer(campos, "nombre"))
    if (!nombre.ok) {
      return await renderPuestos(empleado, almacen, { error: nombre.error, estadoError: 400 })
    }
    const resultado = await almacen.renombrarPuesto(empleado, puestoId, nombre.valor)
    return await responderCambio(resultado, empleado, almacen, "renombrar el puesto")
  }
  const direccion = primer(campos, "direccion")
  if (direccion !== "subir" && direccion !== "bajar") {
    return await renderPuestos(empleado, almacen, {
      error: "Esa dirección no es válida.",
      estadoError: 400,
    })
  }
  const resultado = await almacen.moverPuesto(empleado, puestoId, direccion)
  return await responderCambio(resultado, empleado, almacen, "ordenar el puesto")
}

type RutaPuestos =
  | { readonly tipo: "indice" }
  | {
      readonly tipo: "accion"
      readonly puestoId: string
      readonly accion: "renombrar" | "mover" | "alternar" | "auto"
    }

function reconocer(segmentos: readonly string[]): RutaPuestos | null {
  if (segmentos[0] !== "admin" || segmentos[1] !== "puestos") {
    return null
  }
  const resto = segmentos.slice(2)
  if (resto.length === 0) {
    return { tipo: "indice" }
  }
  const [puestoId, accion] = resto
  if (
    resto.length === 2 &&
    puestoId !== undefined &&
    (accion === "renombrar" || accion === "mover" || accion === "alternar" || accion === "auto")
  ) {
    return { tipo: "accion", puestoId, accion }
  }
  return null
}

/** Se llama antes que `manejarAdmin` para que su gramatica de rutas quede intacta. */
export async function manejarPuestos(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const ruta = reconocer(url.pathname.split("/").filter((trozo) => trozo !== ""))
  if (ruta === null) {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), peticion.method === "GET" ? 200 : 401)
  }
  if (ruta.tipo === "indice") {
    if (peticion.method === "POST") {
      return await crearPuesto(peticion, empleado, dependencias.almacen)
    }
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido("GET, POST")
    }
    return await renderPuestos(empleado, dependencias.almacen, {
      creado: url.searchParams.get("creado") === "1",
      exito: url.searchParams.get("cambiado") === "1" ? "Puesto actualizado." : undefined,
    })
  }
  if (peticion.method !== "POST") {
    return responderMetodoNoPermitido("POST")
  }
  return await cambiarPuesto(peticion, empleado, ruta.puestoId, dependencias.almacen, ruta.accion)
}
