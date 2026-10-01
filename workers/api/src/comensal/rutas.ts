/**
 * Rutas publicas del comensal: la carta, la cesta y el envio de la comanda.
 *
 * El comensal no tiene cuenta: se le identifica por una cookie opaca con el identificador de
 * su sesion de mesa, inalcanzable para el navegador (`HttpOnly`), solo por HTTPS (`Secure`) y
 * con caducidad. La cesta vive en OTRA cookie que solo lleva identificadores y cantidades,
 * nunca precios (D-051): el precio lo fija la base desde la carta al enviar.
 *
 * Toda mutacion entra por POST y vuelve con una redireccion (PRG). Sin JavaScript: la carta,
 * la cesta y el estado de los pedidos se dibujan en el servidor.
 */

import { PATRON_CODIGO_MESA } from "../panel/codigo-mesa.ts"
import { leerCookie } from "../panel/sesion.ts"
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import {
  type AccionDeCesta,
  agregarALaCesta,
  ajustarLaCesta,
  cookieDeCesta,
  cookieDeCestaVacia,
  type LineaDeEnvio,
  leerCesta,
  NOMBRE_COOKIE_CESTA,
  type PlatoResoluble,
  resolverCesta,
  serializarCesta,
  tokenDeEnvio,
} from "./cesta.ts"
import type { AlmacenComensal, CartaDelComensal, LecturaComensal } from "./datos.ts"
import {
  vistaCartaComensal,
  vistaCestaComensal,
  vistaCodigoDesconocido,
  vistaLocalInactivo,
  vistaPedidosComensal,
  vistaSinSesion,
} from "./vistas.ts"

export const NOMBRE_COOKIE_MESA = "camarero_mesa"

/** Cuatro horas: la sesion de mesa se cierra sola por inactividad al cabo de ese tiempo. */
const MAX_AGE_SESION_SEGUNDOS = 4 * 60 * 60

/** Cookie de sesion de mesa: opaca, inalcanzable para el navegador y con caducidad. */
export function cookieDeMesa(sesionId: string): string {
  return [
    `${NOMBRE_COOKIE_MESA}=${sesionId}`,
    `Max-Age=${MAX_AGE_SESION_SEGUNDOS}`,
    "Path=/t",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ")
}

type Campos = Readonly<Record<string, string>>

async function leerCampos(peticion: Request): Promise<Campos> {
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

function pantallaDesconocida(): Response {
  return respuestaHtml(renderizar(vistaCodigoDesconocido()), 404)
}

/**
 * El codigo es correcto, pero el local no esta sirviendo. No es un 404: el recurso (la mesa)
 * existe; es un 503, el servicio para ESE local no esta disponible temporalmente.
 */
function pantallaLocalInactivo(): Response {
  return respuestaHtml(renderizar(vistaLocalInactivo()), 503)
}

function pantallaSinSesion(): Response {
  return respuestaHtml(renderizar(vistaSinSesion()), 400)
}

/** Carta resoluble: la lectura fue "ok". */
function esOk(lectura: LecturaComensal): lectura is Extract<LecturaComensal, { tipo: "ok" }> {
  return lectura.tipo === "ok"
}

function pantallaDeFallo(lectura: Exclude<LecturaComensal, { tipo: "ok" }>): Response {
  return lectura.tipo === "codigo_desconocido" ? pantallaDesconocida() : pantallaLocalInactivo()
}

/** Indice de la carta visible, por plato: es lo unico que puede fijar nombre, precio y destino. */
function preciosDeCarta(carta: CartaDelComensal): Map<string, PlatoResoluble> {
  const indice = new Map<string, PlatoResoluble>()
  for (const categoria of carta.categorias) {
    for (const plato of categoria.platos) {
      indice.set(plato.id, {
        nombre: plato.nombre,
        precioClp: plato.precioClp,
        estacion: plato.estacion,
      })
    }
  }
  return indice
}

// ---------------------------------------------------------------------------
// La carta
// ---------------------------------------------------------------------------

async function mostrarCarta(
  almacen: AlmacenComensal,
  codigo: string,
  cookieMesa: string | null,
  cookieCesta: string | null,
): Promise<Response> {
  if (!PATRON_CODIGO_MESA.test(codigo)) {
    return pantallaDesconocida()
  }
  const lectura = await almacen.abrir(codigo, cookieMesa)
  if (!esOk(lectura)) {
    return pantallaDeFallo(lectura)
  }
  const respuesta = respuestaHtml(
    renderizar(vistaCartaComensal(lectura.carta, codigo, leerCesta(cookieCesta).length)),
    200,
  )
  respuesta.headers.append("set-cookie", cookieDeMesa(lectura.sesionId))
  return respuesta
}

// ---------------------------------------------------------------------------
// La cesta
// ---------------------------------------------------------------------------

function cantidadDeCampos(campos: Campos): number {
  const bruto = Number.parseInt(campos["cantidad"] ?? "1", 10)
  return Number.isInteger(bruto) && bruto >= 1 && bruto <= 99 ? bruto : 1
}

async function agregar(
  peticion: Request,
  codigo: string,
  cookieCesta: string | null,
): Promise<Response> {
  const campos = await leerCampos(peticion)
  const platoId = campos["plato"] ?? ""
  const lineas = agregarALaCesta(leerCesta(cookieCesta), platoId, cantidadDeCampos(campos))
  return responderRedireccion(
    `/t/${encodeURIComponent(codigo)}`,
    cookieDeCesta(serializarCesta(lineas)),
  )
}

function esAccionDeCesta(valor: string): valor is AccionDeCesta {
  return valor === "subir" || valor === "bajar" || valor === "quitar"
}

async function ajustar(
  peticion: Request,
  codigo: string,
  cookieCesta: string | null,
): Promise<Response> {
  const campos = await leerCampos(peticion)
  const accion = campos["accion"] ?? ""
  const platoId = campos["plato"] ?? ""
  const lineas = esAccionDeCesta(accion)
    ? ajustarLaCesta(leerCesta(cookieCesta), platoId, accion)
    : leerCesta(cookieCesta)
  return responderRedireccion(
    `/t/${encodeURIComponent(codigo)}/cesta`,
    cookieDeCesta(serializarCesta(lineas)),
  )
}

async function mostrarCesta(
  almacen: AlmacenComensal,
  codigo: string,
  cookieMesa: string | null,
  cookieCesta: string | null,
  aviso?: string,
): Promise<Response> {
  const lectura = await almacen.abrir(codigo, cookieMesa)
  if (!esOk(lectura)) {
    return pantallaDeFallo(lectura)
  }
  return pintarCesta(lectura.carta, codigo, cookieCesta, aviso, lectura.sesionId)
}

/** Resuelve la cesta contra la carta fresca y dibuja la pantalla. */
function pintarCesta(
  carta: CartaDelComensal,
  codigo: string,
  cookieCesta: string | null,
  aviso: string | undefined,
  sesionId: string,
  estadoHttp = 200,
): Response {
  const { lineas, totalClp } = resolverCesta(leerCesta(cookieCesta), preciosDeCarta(carta))
  const vista = vistaCestaComensal(carta, codigo, lineas, totalClp, {
    clave: tokenDeEnvio(),
    puedeEnviar: carta.estado === "aprobado",
    aviso,
  })
  const respuesta = respuestaHtml(renderizar(vista), estadoHttp)
  respuesta.headers.append("set-cookie", cookieDeMesa(sesionId))
  return respuesta
}

// ---------------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------------

async function enviar(
  peticion: Request,
  almacen: AlmacenComensal,
  codigo: string,
  cookieMesa: string | null,
  cookieCesta: string | null,
): Promise<Response> {
  const lectura = await almacen.abrir(codigo, cookieMesa)
  if (!esOk(lectura)) {
    return pantallaDeFallo(lectura)
  }
  const campos = await leerCampos(peticion)
  const clave = (campos["clave"] ?? "").trim()
  const { lineas } = resolverCesta(leerCesta(cookieCesta), preciosDeCarta(lectura.carta))
  // Solo viaja identificador, cantidad y la estacion de la carta: el destino y el precio los
  // fija la base, nunca la cookie (D-051).
  const enviables: readonly LineaDeEnvio[] = lineas.map((linea) => ({
    platoId: linea.platoId,
    cantidad: linea.cantidad,
    estacion: linea.estacion,
  }))
  const resultado = await almacen.enviar(codigo, lectura.sesionId, clave, enviables)
  if (resultado.tipo === "ok") {
    return responderRedireccion(`/t/${encodeURIComponent(codigo)}/pedidos`, [
      cookieDeCestaVacia(),
      cookieDeMesa(lectura.sesionId),
    ])
  }
  if (resultado.tipo === "codigo_desconocido") {
    return pantallaDesconocida()
  }
  if (resultado.tipo === "sin_sesion") {
    return pantallaSinSesion()
  }
  const aviso =
    resultado.tipo === "sin_aprobar"
      ? "El local todavía no ha aprobado tu mesa, así que aún no puedes enviar."
      : "Tu cesta estaba vacía: añade algún plato antes de enviar."
  return pintarCesta(lectura.carta, codigo, cookieCesta, aviso, lectura.sesionId, 400)
}

// ---------------------------------------------------------------------------
// Estado de los pedidos
// ---------------------------------------------------------------------------

async function mostrarPedidos(
  almacen: AlmacenComensal,
  codigo: string,
  cookieMesa: string | null,
): Promise<Response> {
  const lectura = await almacen.pedidos(codigo, cookieMesa)
  if (lectura.tipo === "codigo_desconocido") {
    return pantallaDesconocida()
  }
  if (lectura.tipo === "sin_sesion") {
    return pantallaSinSesion()
  }
  return respuestaHtml(
    renderizar(vistaPedidosComensal(lectura.local, lectura.mesa, codigo, lectura.pedidos)),
    200,
  )
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------

async function manejarAccionDeCesta(
  peticion: Request,
  almacen: AlmacenComensal,
  codigo: string,
  resto: readonly string[],
  cookieMesa: string | null,
  cookieCesta: string | null,
): Promise<Response> {
  if (resto.length === 1) {
    if (peticion.method === "POST") {
      return await agregar(peticion, codigo, cookieCesta)
    }
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido("GET, POST")
    }
    return await mostrarCesta(almacen, codigo, cookieMesa, cookieCesta)
  }
  if (peticion.method !== "POST") {
    return responderMetodoNoPermitido("POST")
  }
  if (resto[1] === "linea") {
    return await ajustar(peticion, codigo, cookieCesta)
  }
  if (resto[1] === "enviar") {
    return await enviar(peticion, almacen, codigo, cookieMesa, cookieCesta)
  }
  return responderNoEncontrado()
}

/** Devuelve la respuesta del comensal, o null si la ruta no es de la mesa. */
export async function manejarComensal(
  peticion: Request,
  url: URL,
  almacen: AlmacenComensal,
): Promise<Response | null> {
  if (url.pathname !== "/t" && !url.pathname.startsWith("/t/")) {
    return null
  }
  const partes = url.pathname.split("/").filter((trozo) => trozo !== "")
  if (partes.length < 2 || partes.length > 4) {
    return responderNoEncontrado()
  }
  const codigo = decodeURIComponent(partes[1] ?? "")
  const resto = partes.slice(2)
  const cookieMesa = leerCookie(peticion, NOMBRE_COOKIE_MESA)
  const cookieCesta = leerCookie(peticion, NOMBRE_COOKIE_CESTA)

  if (resto.length === 0) {
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido("GET")
    }
    return await mostrarCarta(almacen, codigo, cookieMesa, cookieCesta)
  }
  if (resto[0] === "pareja" && resto.length === 1) {
    if (peticion.method !== "POST") {
      return responderMetodoNoPermitido("POST")
    }
    return await pedirEmparejamiento(almacen, codigo, cookieMesa)
  }
  if (resto[0] === "cesta") {
    return await manejarAccionDeCesta(peticion, almacen, codigo, resto, cookieMesa, cookieCesta)
  }
  if (resto[0] === "pedidos" && resto.length === 1) {
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido("GET")
    }
    return await mostrarPedidos(almacen, codigo, cookieMesa)
  }
  return responderNoEncontrado()
}

async function pedirEmparejamiento(
  almacen: AlmacenComensal,
  codigo: string,
  cookie: string | null,
): Promise<Response> {
  if (!PATRON_CODIGO_MESA.test(codigo)) {
    return pantallaDesconocida()
  }
  const lectura = await almacen.pedir(codigo, cookie)
  if (!esOk(lectura)) {
    return pantallaDeFallo(lectura)
  }
  return responderRedireccion(`/t/${encodeURIComponent(codigo)}`, cookieDeMesa(lectura.sesionId))
}
