/**
 * Pantallas del armazon: entrada, cuadro y permiso denegado.
 *
 * Nada de gestion todavia: el cuadro solo presenta a quien eres y el hueco de lo que vendra.
 * Todo el HTML se construye con la plantilla que escapa por defecto; ningun dato de la base
 * se escribe sin pasar por ella.
 */
import type { Empleado } from "../base.ts"
import { type HtmlSeguro, html } from "../ui/html.ts"

export type Superficie = "admin" | "panel"

/** Inventario de CONTRACT-pantallas: las pantallas futuras de cada superficie. */
const PANTALLAS: Readonly<Record<Superficie, readonly string[]>> = {
  admin: [
    "Alta del local (asistente)",
    "Mesas, zonas y QR para imprimir",
    "Carta (categorias, platos, precios, fotos, orden)",
    "Personal (invitar, roles, PIN)",
    "Ajustes (tema, logo, horarios, modo de servicio)",
    "Pedidos e historico, anular",
    "Metricas",
    "Multi-local y cuota",
  ],
  panel: [
    "Organizaciones y locales (alta, suspension, plan)",
    "Ver como un cliente (motivo y auditoria)",
    "Operacion: estado, errores, colas, copias",
    "Metricas globales",
  ],
}

export function nombreDeSuperficie(superficie: Superficie): string {
  return superficie === "admin" ? "Panel del local" : "Panel de plataforma"
}

function pagina(titulo: string, contenido: HtmlSeguro): HtmlSeguro {
  return html`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Camarero</title>
<link rel="stylesheet" href="/panel/estilos.css">
</head>
<body>
${contenido}
</body>
</html>`
}

function avisoError(mensaje: string): HtmlSeguro {
  return html`<p class="aviso aviso-error" role="alert">${mensaje}</p>`
}

function cabecera(superficie: Superficie, empleado: Empleado): HtmlSeguro {
  const quien = html`<strong>${empleado.nombre}</strong> ·
    ${empleado.rol} · ${nombreDeSuperficie(superficie)}`
  return html`<header class="cabecera">
<span class="marca">Camarero</span>
<span class="quien">${quien}</span>
<span class="crece"></span>
<form method="post" action="/${superficie}/salir">
<button class="boton-salir" type="submit">Salir</button>
</form>
</header>`
}

function listaDePantallas(superficie: Superficie): readonly HtmlSeguro[] {
  return PANTALLAS[superficie].map(
    (pantalla) => html`<li><span>${pantalla}</span><span class="pronto">por construir</span></li>`,
  )
}

function nombreDeLocal(empleado: Empleado): string {
  if (empleado.local === null) {
    return "Sin local asignado (cubre toda la organizacion)"
  }
  return empleado.local.nombre ?? "Sin nombre visible para tu rol"
}

function nombreDeOrganizacion(empleado: Empleado): string {
  return empleado.organizacion.nombre ?? "Sin nombre visible para tu rol"
}

export function vistaEntrada(superficie: Superficie, error?: string): HtmlSeguro {
  const contenido = html`${error === undefined ? html`` : avisoError(error)}
<main class="contenedor">
<section class="tarjeta">
<h1>Entrar</h1>
<p>${nombreDeSuperficie(superficie)}</p>
<form method="post" action="/${superficie}/entrar">
<label class="campo"><span>Correo</span>
<input type="email" name="correo" autocomplete="username" required></label>
<label class="campo"><span>Contrasena</span>
<input type="password" name="contrasena" autocomplete="current-password" required></label>
<button class="boton" type="submit">Entrar</button>
</form>
</section>
</main>`
  return pagina("Entrar", contenido)
}

export function vistaCuadro(superficie: Superficie, empleado: Empleado): HtmlSeguro {
  const contenido = html`${cabecera(superficie, empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>Hola, ${empleado.nombre}</h1>
<dl class="datos">
<dt>Rol</dt><dd>${empleado.rol}</dd>
<dt>Local</dt><dd>${nombreDeLocal(empleado)}</dd>
<dt>Organizacion</dt><dd>${nombreDeOrganizacion(empleado)}</dd>
</dl>
</section>
<h2>Pantallas</h2>
<ul class="pantallas">${listaDePantallas(superficie)}</ul>
</main>`
  return pagina("Panel", contenido)
}

export function vistaPermisoDenegado(superficie: Superficie, empleado: Empleado): HtmlSeguro {
  const destino = superficie === "admin" ? "/panel" : "/admin"
  const esperado = superficie === "admin" ? "el panel del local" : "el panel de plataforma"
  const contenido = html`${cabecera(superficie, empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>No tienes acceso a este panel</h1>
<p>Tu cuenta tiene el rol ${empleado.rol} y este panel es para ${esperado}.</p>
<p>Si crees que es un error, pide a quien administra tu organizacion que revise tu rol.</p>
<p><a class="boton boton-secundario" href="${destino}">Ir a ${esperado}</a></p>
</section>
</main>`
  return pagina("Sin acceso", contenido)
}
