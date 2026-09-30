/**
 * Pantallas del armazón: entrada, cuadro y permiso denegado.
 *
 * Nada de gestión todavía: el cuadro solo presenta a quién eres y el hueco de lo que vendrá.
 * Todo el HTML se construye con la plantilla que escapa por defecto; ningún dato de la base
 * se escribe sin pasar por ella.
 */
import type { Empleado } from "../base.ts"
import { type HtmlSeguro, html, htmlCrudo } from "../ui/html.ts"
import type { DatosLocal, Mesa, Zona } from "./datos.ts"
import { nombreDeRol } from "./roles.ts"

export type Superficie = "admin" | "panel"

/**
 * Inventario de CONTRACT-pantallas. Una pantalla con `href` ya existe y enlaza a su sitio;
 * una sin `href` sigue diciendo "por construir". No se adelanta trabajo del roadmap (D-042).
 */
type PantallaDelCuadro = { readonly titulo: string; readonly href?: string }

const PANTALLAS: Readonly<Record<Superficie, readonly PantallaDelCuadro[]>> = {
  admin: [
    { titulo: "El local (nombre, zona horaria, estado y modo de servicio)", href: "/admin/local" },
    { titulo: "Zonas", href: "/admin/zonas" },
    { titulo: "Mesas y QR para imprimir", href: "/admin/mesas" },
    { titulo: "Alta del local (asistente)" },
    { titulo: "Carta (categorías, platos, precios, fotos, orden)" },
    { titulo: "Personal (invitar, roles, PIN)" },
    { titulo: "Ajustes (tema, logo, horarios, modo de servicio)" },
    { titulo: "Pedidos e histórico, anular" },
    { titulo: "Métricas" },
    { titulo: "Multi-local y cuota" },
  ],
  panel: [
    { titulo: "Organizaciones y locales (alta, suspensión, plan)" },
    { titulo: "Ver como un cliente (motivo y auditoría)" },
    { titulo: "Operación: estado, errores, colas, copias" },
    { titulo: "Métricas globales" },
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
    ${nombreDeRol(empleado.rol)} · ${nombreDeSuperficie(superficie)}`
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
  return PANTALLAS[superficie].map((pantalla) =>
    pantalla.href === undefined
      ? html`<li><span>${pantalla.titulo}</span><span class="pronto">por construir</span></li>`
      : html`<li><a href="${pantalla.href}">${pantalla.titulo}</a></li>`,
  )
}

function nombreDeLocal(empleado: Empleado): string {
  if (empleado.local === null) {
    return "Sin local asignado (cubre toda la organización)"
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
<label class="campo"><span>Correo electrónico</span>
<input type="email" name="correo" autocomplete="username" required></label>
<label class="campo"><span>Contraseña</span>
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
<dt>Rol</dt><dd>${nombreDeRol(empleado.rol)}</dd>
<dt>Local</dt><dd>${nombreDeLocal(empleado)}</dd>
<dt>Organización</dt><dd>${nombreDeOrganizacion(empleado)}</dd>
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
  const nombreCorto = superficie === "admin" ? "panel del local" : "panel de plataforma"
  const contenido = html`${cabecera(superficie, empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>No tienes acceso a este panel</h1>
<p>Tu cuenta tiene el rol ${nombreDeRol(empleado.rol)} y este panel es para ${esperado}.</p>
<p>Si crees que es un error, pide a quien administra tu organización que revise tu rol.</p>
<p><a class="boton boton-secundario" href="${destino}">Ir al ${nombreCorto}</a></p>
</section>
</main>`
  return pagina("Sin acceso", contenido)
}

const ETIQUETA_ESTADO: Readonly<Record<string, string>> = {
  draft: "En montaje",
  active: "En servicio",
  paused: "En pausa",
}

const ETIQUETA_MODO: Readonly<Record<string, string>> = {
  dine_in: "Solo mesa (dine-in)",
  delivery: "Solo retiro o entrega (delivery)",
  both: "Mesa y retiro/entrega (ambos)",
}

function avisoExito(mensaje: string): HtmlSeguro {
  return html`<p class="aviso aviso-exito" role="status">${mensaje}</p>`
}

function enlaceVolverAlPanel(): HtmlSeguro {
  return html`<p class="no-imprimir"><a class="boton boton-secundario" href="/admin">Volver al panel</a></p>`
}

function opcionesDeSelect(
  valores: readonly string[],
  actual: string,
  etiquetas: Readonly<Record<string, string>>,
): HtmlSeguro {
  return html`${valores.map(
    (valor) =>
      html`<option value="${valor}"${valor === actual ? htmlCrudo(" selected") : html``}>${etiquetas[valor] ?? valor}</option>`,
  )}`
}

export function vistaSinLocal(empleado: Empleado): HtmlSeguro {
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>Sin local</h1>
<p>Tu cuenta no tiene un local asignado y no hay ningún local visible en tu organización.</p>
<p>Pide a quien administra el sistema que te asigne un local.</p>
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Sin local", contenido)
}

export function vistaSinPermiso(empleado: Empleado, accion: string): HtmlSeguro {
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>No tienes permiso</h1>
<p>Tu rol (${nombreDeRol(empleado.rol)}) no puede ${accion}.</p>
<p>Si necesitas hacerlo, pide a quien administra tu organización que revise tu rol.</p>
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Sin permiso", contenido)
}

function formularioLocal(local: DatosLocal): HtmlSeguro {
  return html`<form method="post" action="/admin/local">
<label class="campo"><span>Nombre del local</span>
<input type="text" name="nombre" value="${local.nombre}" maxlength="120" required></label>
<label class="campo"><span>Zona horaria</span>
<input type="text" name="zona_horaria" value="${local.timezone}" required>
<span class="ayuda">Nombre IANA, por ejemplo America/Santiago.</span></label>
<label class="campo"><span>Estado</span>
<select name="estado">${opcionesDeSelect(["draft", "active", "paused"], local.status, ETIQUETA_ESTADO)}</select></label>
<p class="aviso aviso-aviso">Pasar el local a «En servicio» es encenderlo por primera vez: a partir de ahí los comensales pueden abrir mesa y pedir. Si aún no está listo, déjalo en «En montaje».</p>
<label class="campo"><span>Modo de servicio</span>
<select name="modo_servicio">${opcionesDeSelect(["dine_in", "delivery", "both"], local.serviceMode, ETIQUETA_MODO)}</select></label>
<p class="dato-fijo"><span>Moneda</span> <strong>${local.currency}</strong> — fija para el piloto en Chile.</p>
<button class="boton" type="submit">Guardar cambios</button>
</form>`
}

function datosLocalDeSoloLectura(local: DatosLocal): HtmlSeguro {
  return html`<p>Puedes ver los datos de tu local, pero solo el dueño de la organización puede cambiarlos.</p>
<dl class="datos">
<dt>Nombre</dt><dd>${local.nombre}</dd>
<dt>Zona horaria</dt><dd>${local.timezone}</dd>
<dt>Estado</dt><dd>${ETIQUETA_ESTADO[local.status] ?? local.status}</dd>
<dt>Modo de servicio</dt><dd>${ETIQUETA_MODO[local.serviceMode] ?? local.serviceMode}</dd>
<dt>Moneda</dt><dd>${local.currency}</dd>
</dl>`
}

export function vistaLocal(
  empleado: Empleado,
  local: DatosLocal,
  puedeEditar: boolean,
  guardado: boolean,
  error?: string,
): HtmlSeguro {
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${error === undefined ? html`` : avisoError(error)}
${guardado ? avisoExito("Cambios guardados.") : html``}
<section class="tarjeta">
<h1>Tu local</h1>
${puedeEditar ? formularioLocal(local) : datosLocalDeSoloLectura(local)}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Tu local", contenido)
}

const ETIQUETA_ZONA: Readonly<Record<string, string>> = {
  sala: "Sala",
  barra: "Barra",
  terraza: "Terraza",
  delivery: "Delivery",
}

const ETIQUETA_MESA: Readonly<Record<string, string>> = {
  mesa: "Mesa",
  barra: "Barra",
}

/** Mensajes y codigo de estado que una pantalla de gestion puede devolver tras una mutacion. */
export type EstadoPantalla = {
  readonly exito?: string
  readonly error?: string
  readonly estadoError?: number
}

function avisosDeEstado(estado: EstadoPantalla): HtmlSeguro {
  return html`${estado.error === undefined ? html`` : avisoError(estado.error)}
${estado.exito === undefined ? html`` : avisoExito(estado.exito)}`
}

function formularioZona(): HtmlSeguro {
  return html`<form method="post" action="/admin/zonas">
<label class="campo"><span>Nombre de la zona</span>
<input type="text" name="nombre" maxlength="120" placeholder="Terraza" required></label>
<label class="campo"><span>Tipo de zona</span>
<select name="tipo">${opcionesDeSelect(["sala", "barra", "terraza", "delivery"], "sala", ETIQUETA_ZONA)}</select></label>
<button class="boton" type="submit">Crear zona</button>
</form>`
}

function listaDeZonas(zonas: readonly Zona[]): HtmlSeguro {
  if (zonas.length === 0) {
    return html`<p>Todavía no hay zonas en tu local.</p>`
  }
  return html`<ul class="plano">${zonas.map(
    (zona) =>
      html`<li><span>${zona.nombre}</span><span class="etiqueta">${ETIQUETA_ZONA[zona.kind] ?? zona.kind}</span><span class="cuenta">${zona.mesas} ${zona.mesas === 1 ? "mesa" : "mesas"}</span></li>`,
  )}</ul>`
}

export function vistaZonas(
  empleado: Empleado,
  zonas: readonly Zona[],
  puedeGestionar: boolean,
  estado: EstadoPantalla & { readonly creada?: boolean },
): HtmlSeguro {
  const exito = estado.creada === true ? "Zona creada." : estado.exito
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Zonas de tu local</h1>
${puedeGestionar ? formularioZona() : html`<p>Solo el dueño o el encargado pueden crear zonas.</p>`}
</section>
<section class="tarjeta">
<h2>Zonas</h2>
${listaDeZonas(zonas)}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Zonas", contenido)
}

function opcionesDeZona(zonas: readonly Zona[]): HtmlSeguro {
  return html`<option value="">Sin zona</option>${zonas.map(
    (zona) => html`<option value="${zona.id}">${zona.nombre}</option>`,
  )}`
}

function formularioMesa(zonas: readonly Zona[]): HtmlSeguro {
  return html`<form method="post" action="/admin/mesas">
<label class="campo"><span>Nombre de la mesa</span>
<input type="text" name="etiqueta" maxlength="120" placeholder="Terraza 4" required></label>
<label class="campo"><span>Zona</span>
<select name="zona">${opcionesDeZona(zonas)}</select></label>
<label class="campo"><span>Capacidad (comensales)</span>
<input type="number" name="capacidad" min="1" max="99" value="2" required></label>
<label class="campo"><span>Tipo</span>
<select name="tipo">${opcionesDeSelect(["mesa", "barra"], "mesa", ETIQUETA_MESA)}</select></label>
<button class="boton" type="submit">Crear mesa</button>
</form>`
}

type GrupoDeMesas = { readonly zona: string; readonly mesas: readonly Mesa[] }

function agruparPorZona(mesas: readonly Mesa[]): readonly GrupoDeMesas[] {
  const porZona = new Map<string, Mesa[]>()
  for (const mesa of mesas) {
    const zona = mesa.zonaNombre ?? "Sin zona"
    const lista = porZona.get(zona)
    if (lista === undefined) {
      porZona.set(zona, [mesa])
    } else {
      lista.push(mesa)
    }
  }
  return [...porZona.entries()].map(([zona, lista]) => ({ zona, mesas: lista }))
}

function formularioAlternar(mesa: Mesa): HtmlSeguro {
  return html`<form method="post" action="/admin/mesas/${mesa.id}/alternar">
<button class="boton boton-secundario" type="submit">${mesa.activa ? "Desactivar" : "Activar"}</button>
</form>`
}

function filaDeMesa(mesa: Mesa, puedeGestionar: boolean): HtmlSeguro {
  const estado = mesa.activa ? "" : " · desactivada"
  return html`<li class="mesa${mesa.activa ? "" : " mesa-inactiva"}">
<span class="mesa-etiqueta">${mesa.etiqueta}</span>
<span class="mesa-codigo">${mesa.codigo}</span>
<span class="mesa-datos">${mesa.capacidad} plazas · ${ETIQUETA_MESA[mesa.kind] ?? mesa.kind}${estado}</span>
${puedeGestionar ? formularioAlternar(mesa) : html``}
</li>`
}

function listaDeMesas(mesas: readonly Mesa[], puedeGestionar: boolean): HtmlSeguro {
  if (mesas.length === 0) {
    return html`<p>Todavía no hay mesas en tu local.</p>`
  }
  return html`${agruparPorZona(mesas).map(
    (grupo) =>
      html`<section class="plano-grupo">
<h3>${grupo.zona}</h3>
<ul class="plano">${grupo.mesas.map((mesa) => filaDeMesa(mesa, puedeGestionar))}</ul>
</section>`,
  )}`
}

export function vistaMesas(
  empleado: Empleado,
  mesas: readonly Mesa[],
  zonas: readonly Zona[],
  puedeGestionar: boolean,
  estado: EstadoPantalla & { readonly creada?: boolean; readonly cambiada?: boolean },
): HtmlSeguro {
  const creada = estado.creada === true ? "Mesa creada." : undefined
  const cambiada = estado.cambiada === true ? "Mesa actualizada." : undefined
  const exito = estado.exito ?? creada ?? cambiada
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Mesas de tu local</h1>
${puedeGestionar ? formularioMesa(zonas) : html`<p>Solo el dueño o el encargado pueden crear mesas.</p>`}
</section>
<section class="tarjeta">
<h2>Mesas</h2>
${listaDeMesas(mesas, puedeGestionar)}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Mesas", contenido)
}
