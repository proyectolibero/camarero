/**
 * Respuesta de salud del borde.
 *
 * Es la senal que consumen las alertas de monitorizacion (D-031). Se mantiene como funcion
 * pura para poder probarla sin el runtime de Workers: recibe la hora y la version en lugar
 * de leerlas, y devuelve una `Response` de Web API, que Node 22 ya trae de serie.
 */

/** Cabeceras de seguridad comunes a todas las respuestas del borde. */
export function cabecerasDeSeguridad(): Headers {
  const cabeceras = new Headers()
  // El borde solo sirve JSON: que nadie lo interprete como otra cosa.
  cabeceras.set("x-content-type-options", "nosniff")
  cabeceras.set("referrer-policy", "no-referrer")
  // HSTS: el borde se sirve siempre por HTTPS. Un solo dominio (D-023), de ahi includeSubDomains.
  cabeceras.set("strict-transport-security", "max-age=31536000; includeSubDomains")
  // Un endpoint de datos no carga nada ni se embebe en ningun sitio.
  cabeceras.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'")
  return cabeceras
}

export type Salud = {
  readonly estado: "ok"
  readonly servicio: "camarero-api"
  readonly version: string
  readonly hora: string
}

export function construirSalud(ahora: Date, version: string): Salud {
  return { estado: "ok", servicio: "camarero-api", version, hora: ahora.toISOString() }
}

export function respuestaJson(cuerpo: unknown, estado: number, cabecerasExtra?: Headers): Response {
  const cabeceras = cabecerasDeSeguridad()
  cabeceras.set("content-type", "application/json; charset=utf-8")
  if (cabecerasExtra !== undefined) {
    for (const [clave, valor] of cabecerasExtra) {
      cabeceras.set(clave, valor)
    }
  }
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras })
}

export function responderSalud(ahora: Date, version: string): Response {
  const cabeceras = new Headers()
  // La salud no se cachea: una respuesta cacheada dejaria de detectar una caida.
  cabeceras.set("cache-control", "no-store")
  return respuestaJson(construirSalud(ahora, version), 200, cabeceras)
}

export function responderNoEncontrado(): Response {
  return respuestaJson({ error: "no_encontrado" }, 404)
}

export function responderError(estado: number, motivo: string): Response {
  return respuestaJson({ error: motivo }, estado)
}

export function responderMetodoNoPermitido(metodos = "GET"): Response {
  const cabeceras = new Headers()
  cabeceras.set("allow", metodos)
  return respuestaJson({ error: "metodo_no_permitido" }, 405, cabeceras)
}
