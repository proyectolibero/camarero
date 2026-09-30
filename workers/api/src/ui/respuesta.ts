/**
 * Respuestas del panel dibujadas por el servidor.
 *
 * Reutiliza las cabeceras comunes del borde (`salud.ts`) y les cambia solo lo que cambia: el
 * CSP de una pagina HTML (que necesita cargar su propia hoja de estilos), el tipo de
 * contenido y la cache. El CSP del panel no admite `unsafe-inline` ni `unsafe-eval`: por eso
 * no hay estilos en linea en ninguna plantilla.
 */
import { cabecerasDeSeguridad } from "../salud.ts"

// style-src 'self' permite la hoja servida en /panel/estilos.css; nada de estilos en linea.
// form-action 'self' impide que un formulario enviado desde aqui apunte a otro sitio.
const CSP_PANEL =
  "default-src 'none'; style-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"

function cabecerasDePanel(): Headers {
  const cabeceras = cabecerasDeSeguridad()
  cabeceras.set("content-security-policy", CSP_PANEL)
  return cabeceras
}

export function respuestaHtml(cuerpo: string, estado = 200): Response {
  const cabeceras = cabecerasDePanel()
  cabeceras.set("content-type", "text/html; charset=utf-8")
  // Una pantalla puede llevar datos de sesion: no se cachea nunca.
  cabeceras.set("cache-control", "no-store")
  return new Response(cuerpo, { status: estado, headers: cabeceras })
}

export function respuestaCss(cuerpo: string): Response {
  const cabeceras = cabecerasDeSeguridad()
  cabeceras.set("content-type", "text/css; charset=utf-8")
  // La hoja cambia con cada despliegue; una cache corta y revalidable es suficiente.
  cabeceras.set("cache-control", "public, max-age=3600")
  return new Response(cuerpo, { headers: cabeceras })
}

/** Redireccion tras una mutacion (POST), como manda la convencion del armazon. */
export function responderRedireccion(destino: string, cookie?: string): Response {
  const cabeceras = cabecerasDePanel()
  cabeceras.set("location", destino)
  cabeceras.set("cache-control", "no-store")
  if (cookie !== undefined) {
    cabeceras.append("set-cookie", cookie)
  }
  return new Response(null, { status: 303, headers: cabeceras })
}
