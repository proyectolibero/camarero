/**
 * Rutas del panel (dueño en /admin, plataforma en /panel).
 *
 * Aquí solo se decide qué se dibuja según el rol. La cerradura de verdad es la RLS: si alguien
 * pide a mano una dirección que no le toca, la base no le devuelve filas. El rol de la fila no
 * es la cerradura.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido } from "../salud.ts"
import { ESTILOS } from "../ui/estilos.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaCss, respuestaHtml } from "../ui/respuesta.ts"
import { manejarAdmin } from "./admin.ts"
import type { Dependencias } from "./proveedor.ts"
import { cookieDeBorrado, cookieDeSesion } from "./sesion.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import { type Superficie, vistaCuadro, vistaEntrada, vistaPermisoDenegado } from "./vistas.ts"

export type { EntornoDePanel } from "./sesion-panel.ts"

type FormularioDeEntrada = {
  readonly correo: string
  readonly contrasena: string
}

const RUTAS_RAIZ: Readonly<Record<string, Superficie>> = {
  "/admin": "admin",
  "/admin/": "admin",
  "/panel": "panel",
  "/panel/": "panel",
}

const RUTAS_ENTRAR: Readonly<Record<string, Superficie>> = {
  "/admin/entrar": "admin",
  "/panel/entrar": "panel",
}

const RUTAS_SALIR: Readonly<Record<string, Superficie>> = {
  "/admin/salir": "admin",
  "/panel/salir": "panel",
}

const RUTA_ESTILOS = "/panel/estilos.css"

/** Mensaje único: no se distingue si el fallo fue el correo o la contraseña. */
export const ERROR_CREDENCIALES = "Correo o contraseña incorrectos."

/** /panel es para platform_admin; /admin, para cualquier otro rol con organización. */
export function puedeEntrar(superficie: Superficie, empleado: Empleado): boolean {
  if (superficie === "panel") {
    return empleado.rol === "platform_admin"
  }
  return empleado.rol !== "platform_admin" && empleado.organizacion.id !== ""
}

async function leerFormulario(peticion: Request): Promise<FormularioDeEntrada | null> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return null
  }
  const datos = new URLSearchParams(await peticion.text())
  const correo = datos.get("correo") ?? ""
  const contrasena = datos.get("contrasena") ?? ""
  if (correo === "" || contrasena === "") {
    return null
  }
  return { correo, contrasena }
}

async function entrarAlPanel(
  superficie: Superficie,
  peticion: Request,
  dependencias: Dependencias,
): Promise<Response> {
  const formulario = await leerFormulario(peticion)
  const pasaporte =
    formulario === null
      ? null
      : await dependencias.autenticar(formulario.correo, formulario.contrasena)
  if (pasaporte === null) {
    return respuestaHtml(renderizar(vistaEntrada(superficie, ERROR_CREDENCIALES)), 401)
  }
  const cookie = cookieDeSesion(pasaporte.token, pasaporte.expiraEnSegundos)
  return responderRedireccion(`/${superficie}`, cookie)
}

async function mostrarPanel(
  superficie: Superficie,
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response> {
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada(superficie)), 200)
  }
  if (!puedeEntrar(superficie, empleado)) {
    return respuestaHtml(renderizar(vistaPermisoDenegado(superficie, empleado)), 403)
  }
  return respuestaHtml(renderizar(vistaCuadro(superficie, empleado)), 200)
}

/** Devuelve la respuesta del panel, o null si la ruta no es del panel. */
export async function manejarPanel(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)

  if (url.pathname === RUTA_ESTILOS) {
    return peticion.method === "GET" ? respuestaCss(ESTILOS) : responderMetodoNoPermitido("GET")
  }

  const raiz = RUTAS_RAIZ[url.pathname]
  if (raiz !== undefined) {
    return peticion.method === "GET"
      ? await mostrarPanel(raiz, peticion, entorno, ahora, dependencias)
      : responderMetodoNoPermitido("GET")
  }

  const entrar = RUTAS_ENTRAR[url.pathname]
  if (entrar !== undefined) {
    return peticion.method === "POST"
      ? await entrarAlPanel(entrar, peticion, dependencias)
      : responderMetodoNoPermitido("POST")
  }

  const salir = RUTAS_SALIR[url.pathname]
  if (salir !== undefined) {
    return peticion.method === "POST"
      ? responderRedireccion(`/${salir}`, cookieDeBorrado())
      : responderMetodoNoPermitido("POST")
  }

  return await manejarAdmin(peticion, entorno, ahora, dependencias)
}
