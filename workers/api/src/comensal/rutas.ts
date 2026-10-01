/**
 * Rutas publicas del comensal: `GET /t/<codigo>` y `POST /t/<codigo>/pareja`.
 *
 * El comensal no tiene cuenta: se le identifica por una cookie opaca con el identificador de
 * su sesion de mesa, inalcanzable para el navegador (`HttpOnly`), solo por HTTPS (`Secure`) y
 * con caducidad. El codigo de la URL no es una credencial: la credencial de verdad es la
 * aprobacion humana de la mesa, que ahora es una barrera de base.
 */
import { PATRON_CODIGO_MESA } from "../panel/codigo-mesa.ts"
import { leerCookie } from "../panel/sesion.ts"
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenComensal, LecturaComensal } from "./datos.ts"
import { vistaCartaComensal, vistaCodigoDesconocido } from "./vistas.ts"

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

function pantallaDesconocida(): Response {
  return respuestaHtml(renderizar(vistaCodigoDesconocido()), 404)
}

async function mostrarCarta(
  almacen: AlmacenComensal,
  codigo: string,
  cookie: string | null,
): Promise<Response> {
  if (!PATRON_CODIGO_MESA.test(codigo)) {
    return pantallaDesconocida()
  }
  const lectura = await almacen.abrir(codigo, cookie)
  if (lectura.tipo === "codigo_desconocido") {
    return pantallaDesconocida()
  }
  return await respuestaConSesion(lectura, codigo)
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
  if (lectura.tipo === "codigo_desconocido") {
    return pantallaDesconocida()
  }
  return responderRedireccion(`/t/${encodeURIComponent(codigo)}`, cookieDeMesa(lectura.sesionId))
}

async function respuestaConSesion(
  lectura: Extract<LecturaComensal, { tipo: "ok" }>,
  codigo: string,
): Promise<Response> {
  const respuesta = respuestaHtml(renderizar(vistaCartaComensal(lectura.carta, codigo)), 200)
  respuesta.headers.append("set-cookie", cookieDeMesa(lectura.sesionId))
  return respuesta
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
  if (partes.length < 2 || partes.length > 3) {
    return responderNoEncontrado()
  }
  const codigo = decodeURIComponent(partes[1] ?? "")
  const accion = partes[2]
  const cookie = leerCookie(peticion, NOMBRE_COOKIE_MESA)

  if (accion === undefined) {
    if (peticion.method !== "GET") {
      return responderMetodoNoPermitido("GET")
    }
    return await mostrarCarta(almacen, codigo, cookie)
  }
  if (accion === "pareja") {
    if (peticion.method !== "POST") {
      return responderMetodoNoPermitido("POST")
    }
    return await pedirEmparejamiento(almacen, codigo, cookie)
  }
  return responderNoEncontrado()
}
