/**
 * Pantallas del armazón: entrada, cuadro y permiso denegado.
 *
 * Nada de gestión todavía: el cuadro solo presenta a quién eres y el hueco de lo que vendrá.
 * Todo el HTML se construye con la plantilla que escapa por defecto; ningún dato de la base
 * se escribe sin pasar por ella.
 */
import {
  type EstadoDeComanda,
  esPantallaTodos,
  estadosPermitidos,
  PANTALLA_TODOS,
  type PuestoDePantalla,
  transicionPermitida,
} from "@camarero/domain"
import type { Empleado } from "../base.ts"
import { type HtmlSeguro, html, htmlCrudo } from "../ui/html.ts"
import { generarQrSvg } from "../ui/qr.ts"
import { ALERGENOS, type Opcion, SIN_CATEGORIA, TAGS } from "./carta-catalogo.ts"
import type {
  Categoria,
  ComandaDePuesto,
  CuentaDeMesa,
  DatosLocal,
  EstadoDeMesa,
  FormaDePago,
  Mesa,
  Plato,
  Puesto,
  ResumenDeMesa,
  SolicitudPendiente,
  Zona,
} from "./datos.ts"
import {
  DESCRIPCION_ESTADO_MESA,
  ESTADOS_DE_MESA,
  ETIQUETA_ESTADO_MESA,
  estadoDeMesa,
  GLIFO_ESTADO_MESA,
} from "./estado-mesa.ts"
import { svgDeZona } from "./mapa-svg.ts"
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
    {
      titulo: "La sala: todas las mesas, sus comandas y sus estados",
      href: "/admin/sala",
    },
    { titulo: "Las cuentas: verlas y registrar el cobro", href: "/admin/cuentas" },
    { titulo: "Solicitudes de emparejamiento", href: "/admin/parejas" },
    {
      titulo: "Puestos de preparación (parrilla, plancha, postre, barra)",
      href: "/admin/puestos",
    },
    { titulo: "Alta del local (asistente)" },
    { titulo: "Carta (categorías, platos, precios, fotos, orden)", href: "/admin/carta" },
    { titulo: "Personal (invitar, roles, PIN)" },
    { titulo: "Ajustes (tema, logo, horarios, modo de servicio)" },
    {
      titulo: "Pedidos por puesto (cocina, barra o todo): aceptar, marcar listos y anular",
      href: "/admin/pedidos",
    },
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

/** `refrescoSegundos` anade un `<meta http-equiv="refresh">`: pantallas que se miran de reojo. */
function pagina(titulo: string, contenido: HtmlSeguro, refrescoSegundos?: number): HtmlSeguro {
  const metaRefresco =
    refrescoSegundos === undefined
      ? html``
      : html`<meta http-equiv="refresh" content="${refrescoSegundos}">`
  return html`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Camarero</title>
${metaRefresco}
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

function listaDePantallas(
  superficie: Superficie,
  pendientes: number | null,
): readonly HtmlSeguro[] {
  return PANTALLAS[superficie].map((pantalla) => {
    if (pantalla.href === undefined) {
      return html`<li><span>${pantalla.titulo}</span><span class="pronto">por construir</span></li>`
    }
    const cuenta =
      pantalla.href === "/admin/parejas" && pendientes !== null && pendientes > 0
        ? ` (${pendientes})`
        : ""
    return html`<li><a href="${pantalla.href}">${pantalla.titulo}${cuenta}</a></li>`
  })
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

export function vistaCuadro(
  superficie: Superficie,
  empleado: Empleado,
  pendientes: number | null = null,
): HtmlSeguro {
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
<ul class="pantallas">${listaDePantallas(superficie, pendientes)}</ul>
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

/** Cuatro botones grandes, uno por direccion. Sin JavaScript: cada uno manda su direccion por POST. */
function controlesDeMovimiento(mesa: Mesa): HtmlSeguro {
  if (mesa.posFila === null || mesa.posColumna === null) {
    return html``
  }
  return html`<form class="mover" method="post" action="/admin/mesas/${mesa.id}/mover">
<button class="mover-boton mover-arriba" type="submit" name="direccion" value="arriba" aria-label="Mover ${mesa.etiqueta} arriba">↑</button>
<button class="mover-boton mover-izquierda" type="submit" name="direccion" value="izquierda" aria-label="Mover ${mesa.etiqueta} a la izquierda">←</button>
<span class="mover-hueco" aria-hidden="true"></span>
<button class="mover-boton mover-derecha" type="submit" name="direccion" value="derecha" aria-label="Mover ${mesa.etiqueta} a la derecha">→</button>
<button class="mover-boton mover-abajo" type="submit" name="direccion" value="abajo" aria-label="Mover ${mesa.etiqueta} abajo">↓</button>
</form>`
}

/** El unico juego de flechas de la pagina, siempre pegado a la mesa elegida en el mapa. */
function bloqueDeMovimiento(mesa: Mesa): HtmlSeguro {
  return html`<div class="mover-caja">
<p class="mover-titulo">Moviendo: <strong>${mesa.etiqueta}</strong>
<a class="mover-quitar" href="/admin/mesas">Dejar de mover</a></p>
${controlesDeMovimiento(mesa)}
</div>`
}

/** Enlace de seleccion: elegir una mesa es un GET, no una mutacion, y se ve en la direccion. */
function urlDeSeleccion(mesa: Mesa): string {
  return `/admin/mesas?mesa=${encodeURIComponent(mesa.id)}`
}

function filaDeMesa(mesa: Mesa, puedeGestionar: boolean): HtmlSeguro {
  const estado = mesa.activa ? "" : " · desactivada"
  const enlaceQr = puedeGestionar
    ? html`<a class="mesa-qr" href="/admin/mesas/${mesa.id}/qr">QR</a>`
    : html``
  const alternar = puedeGestionar ? formularioAlternar(mesa) : html``
  return html`<li class="mesa${mesa.activa ? "" : " mesa-inactiva"}">
<div class="mesa-cabecera">
<span class="mesa-etiqueta">${mesa.etiqueta}</span>
<span class="mesa-codigo">${mesa.codigo}</span>
<span class="mesa-datos">${mesa.capacidad} plazas${estado}</span>
${enlaceQr}
${alternar}
</div>
</li>`
}

function listaDeMesas(
  mesas: readonly Mesa[],
  puedeGestionar: boolean,
  mesaElegida: Mesa | null,
): HtmlSeguro {
  if (mesas.length === 0) {
    return html`<p>Todavía no hay mesas en tu local.</p>`
  }
  const opciones = {
    urlDeMesa: puedeGestionar ? urlDeSeleccion : undefined,
    mesaElegidaId: mesaElegida?.id ?? null,
  }
  return html`${agruparPorZona(mesas).map(
    (grupo, indice) =>
      html`<section class="plano-grupo">
<h3>${grupo.zona}</h3>
${svgDeZona(grupo.zona, grupo.mesas, indice, opciones)}
${mesaElegida !== null && grupo.mesas.some((mesa) => mesa.id === mesaElegida.id) ? bloqueDeMovimiento(mesaElegida) : html``}
<ul class="plano">${grupo.mesas.map((mesa) => filaDeMesa(mesa, puedeGestionar))}</ul>
</section>`,
  )}`
}

export function vistaMesas(
  empleado: Empleado,
  mesas: readonly Mesa[],
  zonas: readonly Zona[],
  puedeGestionar: boolean,
  estado: EstadoPantalla & {
    readonly creada?: boolean
    readonly cambiada?: boolean
    readonly movida?: boolean
  },
  mesaElegidaId: string | null = null,
): HtmlSeguro {
  const creada = estado.creada === true ? "Mesa creada." : undefined
  const cambiada = estado.cambiada === true ? "Mesa actualizada." : undefined
  const movida = estado.movida === true ? "Mesa movida." : undefined
  const exito = estado.exito ?? creada ?? cambiada ?? movida
  const mesaElegida = mesas.find((mesa) => mesa.id === mesaElegidaId) ?? null
  const ayuda =
    puedeGestionar && mesaElegida === null
      ? html`<p class="mover-ayuda">Toca una mesa en el mapa para moverla.</p>`
      : html``
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Mesas de tu local</h1>
${puedeGestionar ? formularioMesa(zonas) : html`<p>Solo el dueño o el encargado pueden crear mesas.</p>`}
</section>
<section class="tarjeta">
<h2>Mesas</h2>
${
  puedeGestionar
    ? html`<p class="no-imprimir"><a class="boton boton-secundario" href="/admin/mesas/qr">Imprimir todos los QR</a></p>`
    : html``
}
${ayuda}
${listaDeMesas(mesas, puedeGestionar, mesaElegida)}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Mesas", contenido)
}

// ---------------------------------------------------------------------------
// La sala: todas las mesas, sus comandas y sus estados (D-053)
// ---------------------------------------------------------------------------

/** Un emparejamiento pendiente tal como lo ensena un aviso de trabajo: su id y su mesa. */
export type EmparejamientoPendiente = {
  readonly solicitudId: string
  readonly mesa: string
}

/**
 * El aviso que las pantallas de trabajo (sala y puestos) ensenan cuando hay emparejamientos
 * esperando. Dice CUANTOS son (un cero que no se ve es un cero invisible) y da un camino
 * directo para aprobar. `volver` es la pantalla a la que se vuelve tras aprobar.
 */
function avisoDeEmparejamientos(
  solicitudes: readonly EmparejamientoPendiente[],
  volver: string,
): HtmlSeguro {
  if (solicitudes.length === 0) {
    return html``
  }
  const cuantos = solicitudes.length
  const frase =
    cuantos === 1
      ? "Hay 1 comensal esperando aprobación."
      : `Hay ${cuantos} comensales esperando aprobación.`
  return html`<section class="tarjeta aviso-emparejamientos">
<h2>Emparejamientos esperando aprobación (${cuantos})</h2>
<p role="alert">${frase} Hasta que alguien los apruebe, no pueden pedir.</p>
<ul class="parejas">${solicitudes.map(
    (solicitud) =>
      html`<li class="pareja">
<span class="pareja-mesa">${solicitud.mesa}</span>
<span class="crece"></span>
<form method="post" action="/admin/parejas/${solicitud.solicitudId}/aprobar">
<input type="hidden" name="volver" value="${volver}">
<button class="boton" type="submit">Aprobar</button>
</form>
</li>`,
  )}</ul>
<p class="ayuda">Para rechazar una solicitud, abre <a href="/admin/parejas">Solicitudes de emparejamiento</a>.</p>
</section>`
}

function glifoDeEstado(estado: EstadoDeMesa): HtmlSeguro {
  const glifo = GLIFO_ESTADO_MESA[estado]
  return glifo === "" ? html`` : html`<span class="sala-glifo" aria-hidden="true">${glifo}</span>`
}

/** Distintivo de estado: glifo (forma) + palabra (texto) + color. Nunca solo color. */
function distintivoDeEstado(estado: EstadoDeMesa): HtmlSeguro {
  return html`<span class="sala-estado sala-estado-${estado}">${glifoDeEstado(estado)}${ETIQUETA_ESTADO_MESA[estado]}</span>`
}

function leyendaDeEstados(): HtmlSeguro {
  return html`<ul class="sala-leyenda">${ESTADOS_DE_MESA.map(
    (estado) =>
      html`<li>
<span class="sala-muestra sala-muestra-${estado}" aria-hidden="true">${GLIFO_ESTADO_MESA[estado]}</span>
<span class="sala-leyenda-texto"><strong>${ETIQUETA_ESTADO_MESA[estado]}</strong> — ${DESCRIPCION_ESTADO_MESA[estado]}</span>
</li>`,
  )}</ul>`
}

type GrupoDeResumenes = {
  readonly zona: string
  readonly resumenes: readonly ResumenDeMesa[]
}

function agruparResumenesPorZona(resumenes: readonly ResumenDeMesa[]): readonly GrupoDeResumenes[] {
  const porZona = new Map<string, ResumenDeMesa[]>()
  for (const resumen of resumenes) {
    const zona = resumen.mesa.zonaNombre ?? "Sin zona"
    const lista = porZona.get(zona)
    if (lista === undefined) {
      porZona.set(zona, [resumen])
    } else {
      lista.push(resumen)
    }
  }
  return [...porZona.entries()].map(([zona, lista]) => ({ zona, resumenes: lista }))
}

function urlDeMesaDeSala(mesa: Mesa): string {
  return `/admin/sala/${encodeURIComponent(mesa.id)}`
}

function listaDeSala(resumenes: readonly ResumenDeMesa[]): HtmlSeguro {
  return html`<ul class="plano">${resumenes.map((resumen) => {
    // Una mesa desactivada no esta en servicio: se dice, en vez de llamarla "libre".
    const distintivo = resumen.mesa.activa
      ? distintivoDeEstado(estadoDeMesa(resumen))
      : html`<span class="sala-estado sala-estado-desactivada">Desactivada</span>`
    const cuenta =
      resumen.comandasSinServir === 0
        ? ""
        : `${resumen.comandasSinServir} ${resumen.comandasSinServir === 1 ? "comanda sin servir" : "comandas sin servir"}`
    const enlaceCuenta =
      resumen.cuentaId === null
        ? html``
        : html`<a class="sala-cuenta" href="/admin/cuentas/${encodeURIComponent(resumen.cuentaId)}">Cuenta pedida</a>`
    return html`<li>
<a class="mesa-enlace" href="${urlDeMesaDeSala(resumen.mesa)}">${resumen.mesa.etiqueta}</a>
${distintivo}
${enlaceCuenta}
<span class="crece"></span>
<span class="mesa-datos">${cuenta}</span>
${resumen.sesionActiva && resumen.mesa.activa ? botonCerrarMesa(resumen.mesa.id) : html``}
</li>`
  })}</ul>`
}

/** Cerrar la mesa es un POST: deja rastro (quien y cuando) y la mesa vuelve a estar libre. */
function botonCerrarMesa(mesaId: string): HtmlSeguro {
  return html`<form class="cerrar-mesa" method="post" action="/admin/sala/${encodeURIComponent(mesaId)}/cerrar">
<button class="boton-mini boton-cerrar" type="submit">Cerrar mesa</button>
</form>`
}

export function vistaSala(
  empleado: Empleado,
  resumenes: readonly ResumenDeMesa[],
  estado: EstadoPantalla & { readonly aprobada?: boolean },
): HtmlSeguro {
  const exito = estado.exito ?? (estado.aprobada === true ? "Emparejamiento aprobado." : undefined)
  const pendientes: readonly EmparejamientoPendiente[] = resumenes
    .filter(
      (resumen): resumen is ResumenDeMesa & { readonly solicitudId: string } =>
        resumen.solicitudId !== null,
    )
    .map((resumen) => ({ solicitudId: resumen.solicitudId, mesa: resumen.mesa.etiqueta }))
  const estados = new Map(resumenes.map((resumen) => [resumen.mesa.id, estadoDeMesa(resumen)]))
  const grupos = agruparResumenesPorZona(resumenes)
  const cuerpoTablas =
    grupos.length === 0
      ? html`<section class="tarjeta"><p>Todavía no hay mesas en tu local.</p></section>`
      : grupos.map(
          (grupo, indice) => html`<section class="tarjeta">
<h2>${grupo.zona}</h2>
${svgDeZona(
  grupo.zona,
  grupo.resumenes.map((resumen) => resumen.mesa),
  indice,
  {
    urlDeMesa: urlDeMesaDeSala,
    estadoDeMesa: (mesa) => estados.get(mesa.id) ?? null,
  },
)}
${listaDeSala(grupo.resumenes)}
</section>`,
        )
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>La sala</h1>
<p>Todas las mesas del local, sin filtrar por puesto, con sus comandas y su estado. Esta pantalla se actualiza sola y no muestra importes: es de servicio, no de caja.</p>
${leyendaDeEstados()}
</section>
${avisoDeEmparejamientos(pendientes, "/admin/sala")}
${cuerpoTablas}
${enlaceVolverAlPanel()}
</main>`
  return pagina("La sala", contenido, 20)
}

/** Una comanda vista desde la sala: su puesto, su estado y sus lineas. Sin precios. */
function comandaDeSala(comanda: ComandaDePuesto, mesaId: string): HtmlSeguro {
  const anulable = transicionPermitida(comanda.estado, "anulada")
  return html`<li class="pedido-cocina pedido-cocina-${comanda.estado}">
<div class="pedido-cabecera">
<span class="pedido-destino">${comanda.destino}</span>
<span class="pedido-estado pedido-estado-${comanda.estado}">${ETIQUETA_ESTADO_COMANDA[comanda.estado]}</span>
<span class="pedido-tiempo">hace ${etiquetaDeTiempo(comanda.creadaHaceSegundos)}</span>
</div>
<ul class="pedido-lineas">${comanda.lineas.map(
    (linea) => html`<li><span>${linea.cantidad}× ${linea.nombre}</span></li>`,
  )}</ul>
${
  anulable
    ? html`<div class="pedido-acciones">
<form method="post" action="/admin/sala/${encodeURIComponent(mesaId)}/comandas/${encodeURIComponent(comanda.id)}/anular">
<button class="boton-mini boton-anular" type="submit">Anular</button>
</form>
</div>`
    : html``
}
</li>`
}

export function vistaDetalleMesa(
  empleado: Empleado,
  resumen: ResumenDeMesa,
  comandas: readonly ComandaDePuesto[],
  estado: EstadoPantalla & { readonly anulada?: boolean },
): HtmlSeguro {
  const exito = estado.exito ?? (estado.anulada === true ? "Comanda anulada." : undefined)
  const estadoMesa = estadoDeMesa(resumen)
  const aviso =
    resumen.solicitudId === null
      ? html``
      : avisoDeEmparejamientos(
          [{ solicitudId: resumen.solicitudId, mesa: resumen.mesa.etiqueta }],
          urlDeMesaDeSala(resumen.mesa),
        )
  const lista =
    comandas.length === 0
      ? html`<p>No hay comandas abiertas en esta mesa.</p>`
      : html`<ul class="pedidos-cocina">${comandas.map((comanda) => comandaDeSala(comanda, resumen.mesa.id))}</ul>`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<p><a class="boton boton-secundario" href="/admin/sala">Volver a la sala</a></p>
<h1>${resumen.mesa.etiqueta}</h1>
<p>${resumen.mesa.zonaNombre ?? "Sin zona"} · ${resumen.mesa.capacidad} plazas · código ${resumen.mesa.codigo}</p>
${distintivoDeEstado(estadoMesa)}
${
  resumen.sesionActiva
    ? html`<p class="cerrar-mesa-detalle">${botonCerrarMesa(resumen.mesa.id)}</p>`
    : html``
}
</section>
${aviso}
<section class="tarjeta">
<h2>Comandas</h2>
${lista}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina(`Mesa · ${resumen.mesa.etiqueta}`, contenido, 20)
}

// ---------------------------------------------------------------------------
// La cuenta: pedirla (comensal), verla y cobrarla (panel)
// ---------------------------------------------------------------------------

export const ETIQUETA_FORMA_DE_PAGO: Readonly<Record<FormaDePago, string>> = {
  tpv_cash: "Efectivo",
  tpv_card: "Tarjeta",
  tpv_other: "Otra forma",
}

/** Orden del selector: primero lo mas probable. Son EXACTAMENTE los del `check` del esquema. */
const FORMAS_DE_PAGO: readonly FormaDePago[] = ["tpv_cash", "tpv_card", "tpv_other"]

function etiquetaDeCuenta(cuenta: CuentaDeMesa): HtmlSeguro {
  return cuenta.cobrada
    ? html`<span class="insignia insignia-ok">Cobrada</span>`
    : html`<span class="insignia insignia-aviso">Pedida</span>`
}

function cobroDeCuenta(cuenta: CuentaDeMesa): HtmlSeguro {
  if (!cuenta.cobrada) {
    return html``
  }
  const forma = cuenta.formaDePago === null ? "—" : ETIQUETA_FORMA_DE_PAGO[cuenta.formaDePago]
  const quien = cuenta.cobradaPor ?? "un empleado"
  const cuando =
    cuenta.pagadaHaceSegundos === null
      ? ""
      : ` · hace ${etiquetaDeTiempo(cuenta.pagadaHaceSegundos)}`
  return html`<span class="cuenta-cobro">Cobrada por ${quien} · ${forma}${cuando}</span>`
}

function filaDeCuenta(cuenta: CuentaDeMesa): HtmlSeguro {
  return html`<li class="cuenta-linea">
<a class="cuenta-mesa" href="/admin/cuentas/${encodeURIComponent(cuenta.id)}">${cuenta.mesa}</a>
${etiquetaDeCuenta(cuenta)}
<span class="crece"></span>
<span class="cuenta-importe">${formatearPrecio(cuenta.importeClp)}</span>
${cobroDeCuenta(cuenta)}
</li>`
}

export function vistaCuentas(
  empleado: Empleado,
  cuentas: readonly CuentaDeMesa[],
  estado: EstadoPantalla & { readonly cobrada?: boolean },
): HtmlSeguro {
  const exito =
    estado.exito ?? (estado.cobrada === true ? "Cobro registrado y mesa cerrada." : undefined)
  const pendientes = cuentas.filter((cuenta) => !cuenta.cobrada).length
  const resumenPendientes =
    pendientes === 0
      ? "No queda ninguna cuenta por cobrar."
      : pendientes === 1
        ? "Hay 1 cuenta por cobrar."
        : `Hay ${pendientes} cuentas por cobrar.`
  const lista =
    cuentas.length === 0
      ? html`<p>No hay cuentas pedidas ahora mismo.</p>`
      : html`<ul class="cuentas">${cuentas.map(filaDeCuenta)}</ul>`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Las cuentas</h1>
<p>Las cuentas que han pedido los comensales, con su mesa y lo que llevan consumido. Registrar el cobro cierra la mesa. <strong>El dinero no pasa por aquí:</strong> solo se anota que un empleado cobró en el TPV.</p>
<p>${resumenPendientes}</p>
${lista}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Las cuentas", contenido)
}

function campoFormaDePago(): HtmlSeguro {
  return html`<label class="campo"><span>Forma de pago</span>
<select name="forma_pago">
${FORMAS_DE_PAGO.map((forma) => html`<option value="${forma}">${ETIQUETA_FORMA_DE_PAGO[forma]}</option>`)}
</select>
<span class="ayuda">Solo se guarda la etiqueta: ni número de tarjeta, ni autorización, ni referencia de pago.</span></label>`
}

function campoPropina(): HtmlSeguro {
  return html`<label class="campo"><span>Propina</span>
<select name="propina">
<option value="0">Sin propina (0 %)</option>
<option value="5">5 %</option>
<option value="10">10 %</option>
<option value="15">15 %</option>
<option value="20">20 %</option>
</select>
<span class="ayuda">Se calcula sobre el importe ya descontado, nunca sobre el subtotal.</span></label>`
}

function importesDeLaCuenta(cuenta: CuentaDeMesa): HtmlSeguro {
  const descuento =
    cuenta.descuentoClp > 0
      ? html`<dt>Descuento</dt><dd>− ${formatearPrecio(cuenta.descuentoClp)}</dd>`
      : html``
  return html`<dl class="datos">
<dt>Subtotal</dt><dd>${formatearPrecio(cuenta.subtotalClp)}</dd>
${descuento}
<dt>${cuenta.cobrada ? "Importe cobrado" : "Importe a pagar"}</dt><dd><strong>${formatearPrecio(cuenta.importeClp)}</strong></dd>
${
  cuenta.cobrada && cuenta.propinaClp !== null && cuenta.totalClp !== null
    ? html`<dt>Propina</dt><dd>${formatearPrecio(cuenta.propinaClp)}</dd>
<dt>Total con propina</dt><dd><strong>${formatearPrecio(cuenta.totalClp)}</strong></dd>`
    : html``
}
</dl>`
}

export function vistaCuenta(
  empleado: Empleado,
  cuenta: CuentaDeMesa,
  comandas: readonly ComandaDePuesto[],
  puedeCobrar: boolean,
  estado: EstadoPantalla,
): HtmlSeguro {
  const lista =
    comandas.length === 0
      ? html`<p>Esta mesa todavía no tiene comandas.</p>`
      : html`<ul class="pedidos-cocina">${comandas.map((comanda) => comandaDeSala(comanda, cuenta.mesaId))}</ul>`
  const accion = cuenta.cobrada
    ? html`<p class="aviso aviso-exito" role="status">Cobro registrado: la mesa ya está cerrada.</p>`
    : puedeCobrar
      ? html`<form method="post" action="/admin/cuentas/${encodeURIComponent(cuenta.id)}/cobrar">
${campoPropina()}
${campoFormaDePago()}
<p class="aviso aviso-aviso"><strong>El importe lo calcula el sistema</strong> a partir de lo que hay en la base; no se escribe a mano. Al registrar el cobro, la mesa se cierra.</p>
<button class="boton" type="submit">Registrar el cobro y cerrar la mesa</button>
</form>`
      : html`<p>Tu rol no puede registrar cobros. Pídeselo a quien atiende la caja.</p>`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado(estado)}
<section class="tarjeta">
<p><a class="boton boton-secundario" href="/admin/cuentas">Volver a las cuentas</a></p>
<h1>Cuenta de ${cuenta.mesa}</h1>
${etiquetaDeCuenta(cuenta)}
${cobroDeCuenta(cuenta)}
</section>
<section class="tarjeta">
<h2>Lo que ha consumido</h2>
${lista}
</section>
<section class="tarjeta">
<h2>La cuenta</h2>
${importesDeLaCuenta(cuenta)}
${accion}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina(`Cuenta · ${cuenta.mesa}`, contenido)
}

/** Pantalla sencilla para un aviso claro que no encaja en las tarjetas de gestion. */
export function vistaAviso(empleado: Empleado, titulo: string, mensaje: string): HtmlSeguro {
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>${titulo}</h1>
<p>${mensaje}</p>
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina(titulo, contenido)
}

function fichaDeQr(etiqueta: string, codigo: string, contenido: string): HtmlSeguro {
  return html`<section class="qr-ficha">
<p class="qr-etiqueta">${etiqueta}</p>
<div class="qr">${htmlCrudo(generarQrSvg(contenido, `QR de ${etiqueta}`))}</div>
<p class="qr-codigo">${codigo}</p>
</section>`
}

export function vistaQrMesa(empleado: Empleado, mesa: Mesa, contenido: string): HtmlSeguro {
  const cuerpo = html`${cabecera("admin", empleado)}
<main class="contenedor">
<section class="tarjeta">
<h1>${mesa.etiqueta}</h1>
<div class="qr">${htmlCrudo(generarQrSvg(contenido, `QR de ${mesa.etiqueta}`))}</div>
<p class="qr-codigo">${mesa.codigo}</p>
<p class="qr-url">${contenido}</p>
</section>
<p class="no-imprimir">
<a class="boton" href="/admin/mesas/qr">Imprimir todos</a>
<a class="boton boton-secundario" href="/admin/mesas">Volver a las mesas</a>
</p>
</main>`
  return pagina(`QR · ${mesa.etiqueta}`, cuerpo)
}

export function vistaQrTodas(
  empleado: Empleado,
  mesas: readonly Mesa[],
  contenidoDeMesa: (mesa: Mesa) => string,
): HtmlSeguro {
  const fichas = mesas.map((mesa) => fichaDeQr(mesa.etiqueta, mesa.codigo, contenidoDeMesa(mesa)))
  const introduccion =
    mesas.length === 0
      ? html`<p class="no-imprimir">Todavía no hay mesas que imprimir.</p>`
      : html`<div class="hoja-mesas">${fichas}</div>`
  const cuerpo = html`${cabecera("admin", empleado)}
<main class="contenedor">
<h1 class="no-imprimir">QR de las mesas</h1>
<p class="no-imprimir">Usa «Imprimir» del navegador. Cada ficha lleva su código en grande para dictarlo por teléfono.</p>
${introduccion}
<p class="no-imprimir"><a class="boton boton-secundario" href="/admin/mesas">Volver a las mesas</a></p>
</main>`
  return pagina("QR de las mesas", cuerpo)
}

// ---------------------------------------------------------------------------
// La carta: categorias, platos y bebidas
// ---------------------------------------------------------------------------

/** Valores en crudo del formulario de alta, para no perder lo escrito si algo falla. */
export type BorradorPlato = {
  readonly nombre: string
  readonly descripcion: string
  readonly precio: string
  readonly categoria: string
  readonly puesto: string
  readonly disponible: boolean
  readonly activo: boolean
  readonly desde: string
  readonly hasta: string
  readonly orden: string
  readonly tags: readonly string[]
  readonly allergens: readonly string[]
}

/** Con qué se abre el formulario de alta: categoría y puesto ya elegidos. */
export type InicialesPlato = {
  readonly categoria: string | null
  readonly puestoId: string | null
  readonly bebida: boolean
}

/** Reconoce una categoría de bebidas por su nombre, sin acentos ni mayúsculas. */
function esCategoriaDeBebidas(nombre: string): boolean {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  return limpio.includes("bebida")
}

function categoriaDeBebidas(categorias: readonly Categoria[]): Categoria | null {
  return categorias.find((categoria) => esCategoriaDeBebidas(categoria.nombre)) ?? null
}

/**
 * Atajo de bebidas: el mismo formulario de alta, con la estación en barra y la categoría de
 * bebidas preseleccionada si existe. Si no existe, el formulario lo dice con claridad.
 */
function urlAtajoBebida(categorias: readonly Categoria[]): string {
  const bebidas = categoriaDeBebidas(categorias)
  const sufijo = bebidas === null ? "" : `&categoria=${encodeURIComponent(bebidas.id)}`
  // El puesto lo hereda de la categoria de bebidas: el dueno lo pone una vez (ADR-0034).
  return `/admin/carta/plato?bebida=1${sufijo}`
}

const FORMATO_CLP = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

function formatearPrecio(clp: number): string {
  return `$ ${FORMATO_CLP.format(clp)}`
}

function opcionesDeCatalogo(
  opciones: readonly Opcion[],
  actual: string | null,
  vacio: string,
): HtmlSeguro {
  return html`<option value=""${actual === null ? htmlCrudo(" selected") : html``}>${vacio}</option>${opciones.map(
    (opcion) =>
      html`<option value="${opcion.valor}"${opcion.valor === actual ? htmlCrudo(" selected") : html``}>${opcion.etiqueta}</option>`,
  )}`
}

function casillas(
  nombre: string,
  opciones: readonly Opcion[],
  seleccionados: ReadonlySet<string>,
): HtmlSeguro {
  return html`${opciones.map(
    (opcion) =>
      html`<label class="casilla"><input type="checkbox" name="${nombre}" value="${opcion.valor}"${seleccionados.has(opcion.valor) ? htmlCrudo(" checked") : html``}><span>${opcion.etiqueta}</span></label>`,
  )}`
}

function botonesDeOrden(accion: string): HtmlSeguro {
  return html`<form class="mover-orden" method="post" action="${accion}">
<button class="boton-mini" type="submit" name="direccion" value="subir" aria-label="Subir">↑</button>
<button class="boton-mini" type="submit" name="direccion" value="bajar" aria-label="Bajar">↓</button>
</form>`
}

function formularioAlternarCategoria(categoria: Categoria): HtmlSeguro {
  return html`<form method="post" action="/admin/carta/categoria/${categoria.id}/alternar">
<button class="boton-mini" type="submit">${categoria.activa ? "Ocultar" : "Mostrar"}</button>
</form>`
}

function formularioRenombrarCategoria(categoria: Categoria): HtmlSeguro {
  return html`<form class="renombrar" method="post" action="/admin/carta/categoria/${categoria.id}/renombrar">
<input type="text" name="nombre" value="${categoria.nombre}" maxlength="120" required aria-label="Nuevo nombre de la categoría">
<button class="boton-mini" type="submit">Renombrar</button>
</form>`
}

function formularioNuevaCategoria(): HtmlSeguro {
  return html`<form method="post" action="/admin/carta">
<label class="campo"><span>Nueva categoría</span>
<input type="text" name="nombre" maxlength="120" placeholder="Entrantes" required></label>
<button class="boton" type="submit">Crear categoría</button>
</form>`
}

/** Nombre del puesto de una lista; si ya no esta, dice que no tiene. Nunca inventa. */
function nombreDePuesto(puestos: readonly Puesto[], puestoId: string | null): string {
  if (puestoId === null) {
    return "Sin puesto"
  }
  return puestos.find((puesto) => puesto.id === puestoId)?.nombre ?? "Puesto retirado"
}

function filaDeCategoria(
  categoria: Categoria,
  puestos: readonly Puesto[],
  puedeGestionar: boolean,
): HtmlSeguro {
  const estado = categoria.activa ? "Activa" : "Oculta"
  const gestion = puedeGestionar
    ? html`${botonesDeOrden(`/admin/carta/categoria/${categoria.id}/mover`)}
${formularioRenombrarCategoria(categoria)}
${formularioAlternarCategoria(categoria)}`
    : html``
  return html`<li class="carta-categoria${categoria.activa ? "" : " carta-oculta"}">
<div class="carta-linea">
<a class="carta-nombre" href="/admin/carta/${categoria.id}">${categoria.nombre}</a>
<span class="carta-estado">${estado}</span>
<span class="carta-estado">${nombreDePuesto(puestos, categoria.puestoId)}</span>
<span class="crece"></span>
${gestion}
</div>
</li>`
}

function listaDeCategorias(
  categorias: readonly Categoria[],
  puestos: readonly Puesto[],
  puedeGestionar: boolean,
): HtmlSeguro {
  if (categorias.length === 0) {
    return html`<p>Todavía no hay categorías. Crea la primera arriba.</p>`
  }
  return html`<ul class="carta-lista">${categorias.map((categoria) => filaDeCategoria(categoria, puestos, puedeGestionar))}</ul>`
}

export function vistaCarta(
  empleado: Empleado,
  categorias: readonly Categoria[],
  puestos: readonly Puesto[],
  puedeGestionar: boolean,
  estado: EstadoPantalla & { readonly creada?: boolean },
): HtmlSeguro {
  const exito = estado.creada === true ? "Categoría creada." : estado.exito
  const acciones = puedeGestionar
    ? html`<p class="acciones-carta">
<a class="boton" href="/admin/carta/plato">Añadir plato o bebida</a>
<a class="boton boton-secundario" href="${urlAtajoBebida(categorias)}">Añadir bebida</a>
</p>`
    : html``
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Carta</h1>
<p>Las categorías ordenan la carta del comensal. Una categoría oculta no se ve, pero no se borra.</p>
${acciones}
${puedeGestionar ? formularioNuevaCategoria() : html`<p>Puedes consultar la carta, pero solo el dueño o el encargado pueden cambiarla.</p>`}
</section>
<section class="tarjeta">
<h2>Categorías</h2>
<p>Cada categoría trae un puesto de preparación. Todas sus fichas lo heredan; un plato puede anularlo. Así una carta de cien bebidas se reparte poniendo el puesto una sola vez.</p>
${listaDeCategorias(categorias, puestos, puedeGestionar)}
<p><a href="/admin/carta/sin-categoria">Ver los platos sin categoría</a></p>
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Carta", contenido)
}

function insigniasDePlato(plato: Plato): HtmlSeguro {
  if (plato.activo && plato.disponible) {
    return html`<span class="insignia insignia-ok">Disponible</span>`
  }
  return html`${plato.activo ? html`` : html`<span class="insignia insignia-retirado">Retirado</span>`}
${plato.disponible ? html`` : html`<span class="insignia insignia-agotado">Agotado</span>`}`
}

function fotoDePlato(plato: Plato): HtmlSeguro {
  if (plato.fotoClave === null) {
    return html`<span class="plato-sinfoto" aria-hidden="true">Sin foto</span>`
  }
  return html`<img class="plato-foto" src="/cartas/${plato.fotoClave}" alt="Foto de ${plato.nombre}" loading="lazy">`
}

function formularioAlternarPlato(plato: Plato): HtmlSeguro {
  return html`<form class="plato-acciones" method="post" action="/admin/carta/plato/${plato.id}/alternar">
<button class="boton-mini" type="submit" name="campo" value="disponible">${plato.disponible ? "Marcar agotado" : "Marcar disponible"}</button>
<button class="boton-mini" type="submit" name="campo" value="activo">${plato.activo ? "Retirar" : "Activar"}</button>
</form>`
}

function filaDePlato(
  plato: Plato,
  puestos: readonly Puesto[],
  heredado: string | null,
  puedeGestionar: boolean,
): HtmlSeguro {
  // Se ensena de donde le llega el puesto: el suyo o el heredado de la categoria.
  const detalles =
    plato.puestoId === null
      ? ` · hereda ${nombreDePuesto(puestos, heredado)}`
      : ` · ${nombreDePuesto(puestos, plato.puestoId)}`
  const gestion = puedeGestionar
    ? html`<div class="plato-gestion">
<a class="boton-mini" href="/admin/carta/plato/${plato.id}">Editar</a>
<form method="post" action="/admin/carta/plato/${plato.id}/duplicar">
<button class="boton-mini" type="submit">Duplicar</button>
</form>
${botonesDeOrden(`/admin/carta/plato/${plato.id}/mover`)}
${formularioAlternarPlato(plato)}
</div>`
    : html``
  const clases = ["carta-plato"]
  if (!plato.activo) {
    clases.push("carta-plato-retirado")
  }
  if (!plato.disponible) {
    clases.push("carta-plato-agotado")
  }
  return html`<li class="${clases.join(" ")}">
${fotoDePlato(plato)}
<div class="plato-texto">
<span class="plato-nombre">${plato.nombre}</span>
<span class="plato-datos">${formatearPrecio(plato.precioClp)}${detalles}</span>
${insigniasDePlato(plato)}
</div>
${gestion}
</li>`
}

function listaDePlatos(
  platos: readonly Plato[],
  puestos: readonly Puesto[],
  heredado: string | null,
  puedeGestionar: boolean,
): HtmlSeguro {
  if (platos.length === 0) {
    return html`<p>Todavía no hay platos ni bebidas en esta categoría.</p>`
  }
  return html`<ul class="carta-lista">${platos.map((plato) => filaDePlato(plato, puestos, heredado, puedeGestionar))}</ul>`
}

/** Formulario que fija el puesto por defecto de la categoría: se pone una vez y se hereda. */
function formularioPuestoDeCategoria(categoria: Categoria, puestos: readonly Puesto[]): HtmlSeguro {
  return html`<form class="puesto-categoria" method="post" action="/admin/carta/categoria/${categoria.id}/puesto">
<label class="campo"><span>Puesto por defecto de la categoría</span>
<select name="puesto">
<option value=""${categoria.puestoId === null ? htmlCrudo(" selected") : html``}>Sin puesto (usa el del local)</option>
${puestos.map(
  (puesto) =>
    html`<option value="${puesto.id}"${puesto.id === categoria.puestoId ? htmlCrudo(" selected") : html``}>${puesto.nombre}${puesto.autoAcepta ? " (nace aceptado)" : ""}</option>`,
)}
</select></label>
<button class="boton" type="submit">Guardar puesto</button>
</form>`
}

export function vistaCategoria(
  empleado: Empleado,
  categoria: Categoria,
  platos: readonly Plato[],
  puestos: readonly Puesto[],
  puedeGestionar: boolean,
  estado: EstadoPantalla,
): HtmlSeguro {
  const avisoPuesto =
    puedeGestionar && puestos.length === 0
      ? html`<p class="aviso aviso-aviso" role="status">Todavía no tienes puestos. <a href="/admin/puestos">Crea el primero</a> para repartir la carta.</p>`
      : html``
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado(estado)}
<section class="tarjeta">
<h1>${categoria.nombre}</h1>
<p><a class="boton boton-secundario" href="/admin/carta">Volver a la carta</a>
${
  puedeGestionar
    ? html`<a class="boton" href="/admin/carta/plato?categoria=${categoria.id}">Añadir plato o bebida</a>`
    : html``
}
</p>
</section>
<section class="tarjeta">
<h2>Puesto de la categoría</h2>
${avisoPuesto}
${
  puedeGestionar
    ? formularioPuestoDeCategoria(categoria, puestos)
    : html`<p>Puesto por defecto: ${nombreDePuesto(puestos, categoria.puestoId)}.</p>`
}
<p class="ayuda">Las fichas sin puesto propio usan este. Un plato puede anularlo en su ficha.</p>
</section>
<section class="tarjeta">
<h2>Platos y bebidas</h2>
${listaDePlatos(platos, puestos, categoria.puestoId, puedeGestionar)}
</section>
</main>`
  return pagina(categoria.nombre, contenido)
}

function campoCategoria(categorias: readonly Categoria[], actual: string | null): HtmlSeguro {
  return html`<label class="campo"><span>Categoría</span>
<select name="categoria">${opcionesDeCatalogo(
    categorias.map((categoria) => ({ valor: categoria.id, etiqueta: categoria.nombre })),
    actual,
    "Sin categoría",
  )}</select></label>`
}

function categoriaDeBorrador(valor: string): string | null {
  return valor === "" || valor === SIN_CATEGORIA ? null : valor
}

/** Campo del formulario que deja anular el puesto de la categoría; vacío significa heredar. */
function campoPuesto(
  puestos: readonly Puesto[],
  actual: string | null,
  heredado: string | null,
): HtmlSeguro {
  const etiquetaHeredar =
    heredado === null
      ? "Heredar de la categoría (sin puesto, usa el del local)"
      : `Heredar de la categoría (${heredado})`
  return html`<label class="campo"><span>Puesto de preparación</span>
<select name="puesto">
<option value=""${actual === null ? htmlCrudo(" selected") : html``}>${etiquetaHeredar}</option>
${puestos.map(
  (puesto) =>
    html`<option value="${puesto.id}"${puesto.id === actual ? htmlCrudo(" selected") : html``}>${puesto.nombre}${puesto.autoAcepta ? " (nace aceptado)" : ""}${puesto.activo ? "" : " (desactivado)"}</option>`,
)}
</select>
<span class="ayuda">El plato hereda el puesto de su categoría si no le pones uno propio. Un plato sin puesto por ningún lado va al puesto por defecto del local.</span></label>`
}

/** El campo de foto del alta: opcional, y se valida antes de crear nada (mensaje en el formulario). */
function campoFotoNueva(): HtmlSeguro {
  return html`<fieldset class="grupo">
<legend>Foto</legend>
<label class="campo"><span>Foto (opcional)</span>
<input type="file" name="foto" accept="image/jpeg,image/png,image/webp"></label>
<span class="ayuda">Solo JPEG, PNG o WebP, hasta 5 MB. El SVG no se acepta. Si la foto no vale, no se crea nada y no pierdes lo que escribiste.</span>
</fieldset>`
}

function avisoSinCategoriaDeBebidas(): HtmlSeguro {
  return html`<p class="aviso aviso-aviso" role="status">Todavía no tienes una categoría de bebidas. Puedes guardar la bebida sin categoría o <a href="/admin/carta">crear antes la categoría en «Carta»</a>.</p>`
}

function formularioPlato(
  plato: Plato | null,
  borrador: BorradorPlato | null,
  categorias: readonly Categoria[],
  puestos: readonly Puesto[],
  iniciales: InicialesPlato,
): HtmlSeguro {
  const esNuevo = plato === null
  const nombre = borrador?.nombre ?? plato?.nombre ?? ""
  const descripcion = borrador?.descripcion ?? plato?.descripcion ?? ""
  const precio = borrador?.precio ?? (plato === null ? "" : String(plato.precioClp))
  const categoria =
    borrador !== null
      ? categoriaDeBorrador(borrador.categoria)
      : (plato?.categoriaId ?? iniciales.categoria)
  const puesto =
    borrador !== null
      ? borrador.puesto === ""
        ? null
        : borrador.puesto
      : (plato?.puestoId ?? iniciales.puestoId)
  const puestoDeLaCategoria =
    categoria === null
      ? null
      : (categorias.find((ficha) => ficha.id === categoria)?.puestoId ?? null)
  const disponible = borrador?.disponible ?? plato?.disponible ?? true
  const activo = borrador?.activo ?? plato?.activo ?? true
  const desde = borrador?.desde ?? plato?.desde ?? ""
  const hasta = borrador?.hasta ?? plato?.hasta ?? ""
  const orden = borrador?.orden ?? (plato === null ? "0" : String(plato.orden))
  const tags = new Set(borrador?.tags ?? plato?.tags ?? [])
  const allergens = new Set(borrador?.allergens ?? plato?.allergens ?? [])
  const accion = esNuevo ? "/admin/carta/plato" : `/admin/carta/plato/${plato.id}`
  const enctype = esNuevo ? htmlCrudo(' enctype="multipart/form-data"') : html``
  const ocultoBebida =
    esNuevo && iniciales.bebida ? html`<input type="hidden" name="bebida" value="1">` : html``
  const avisoBebidas =
    esNuevo && iniciales.bebida && categoria === null ? avisoSinCategoriaDeBebidas() : html``
  return html`<form method="post" action="${accion}"${enctype}>
${ocultoBebida}
<label class="campo"><span>Nombre</span>
<input type="text" name="nombre" value="${nombre}" maxlength="120" required></label>
<label class="campo"><span>Descripción</span>
<textarea name="descripcion" rows="3" maxlength="500">${descripcion}</textarea>
<span class="ayuda">Opcional. Ingredientes, tamaño de la ración, lo que ayude a elegir.</span></label>
<label class="campo"><span>Precio (pesos chilenos)</span>
<input type="text" name="precio" inputmode="numeric" value="${precio}" placeholder="4500" required>
<span class="ayuda">Número entero de pesos, sin decimales ni puntos. Por ejemplo: 4500.</span></label>
${avisoBebidas}
${campoCategoria(categorias, categoria)}
${campoPuesto(puestos, puesto, nombreDePuesto(puestos, puestoDeLaCategoria))}
<fieldset class="grupo">
<legend>Disponibilidad</legend>
<label class="casilla"><input type="checkbox" name="disponible" value="1"${disponible ? htmlCrudo(" checked") : html``}><span>Disponible ahora</span></label>
<label class="casilla"><input type="checkbox" name="activo" value="1"${activo ? htmlCrudo(" checked") : html``}><span>Activo en la carta</span></label>
<span class="ayuda">«Agotado» es temporal y volverá; «retirado» es quitarlo de la carta sin borrar su historial.</span>
<label class="campo campo-en-linea"><span>Desde</span>
<input type="time" name="desde" value="${desde}"></label>
<label class="campo campo-en-linea"><span>Hasta</span>
<input type="time" name="hasta" value="${hasta}"></label>
<span class="ayuda">Vacío significa todo el día. Por ejemplo, desayunos de 08:00 a 11:30.</span>
</fieldset>
<label class="campo"><span>Orden</span>
<input type="number" name="orden" min="0" max="9999" value="${orden}"></label>
<fieldset class="grupo">
<legend>Etiquetas dietéticas</legend>
${casillas("tags", TAGS, tags)}
</fieldset>
<fieldset class="grupo">
<legend>Alérgenos</legend>
${casillas("alergenos", ALERGENOS, allergens)}
</fieldset>
${esNuevo ? campoFotoNueva() : html``}
${
  esNuevo
    ? html`<div class="acciones-alta">
<button class="boton" type="submit">Crear</button>
<button class="boton boton-secundario" type="submit" name="continuar" value="otro">Guardar y añadir otro</button>
</div>`
    : html`<button class="boton" type="submit">Guardar cambios</button>`
}
</form>`
}

function seccionFoto(plato: Plato): HtmlSeguro {
  const actual =
    plato.fotoClave === null
      ? html`<p class="ayuda">Este plato todavía no tiene foto.</p>`
      : html`<div class="foto-actual">
${fotoDePlato(plato)}
<form method="post" action="/admin/carta/plato/${plato.id}/foto/borrar">
<button class="boton-mini" type="submit">Quitar foto</button>
</form>
</div>`
  return html`<section class="tarjeta">
<h2>Foto</h2>
${actual}
<form method="post" action="/admin/carta/plato/${plato.id}/foto" enctype="multipart/form-data">
<label class="campo"><span>${plato.fotoClave === null ? "Subir una foto" : "Sustituir la foto"}</span>
<input type="file" name="foto" accept="image/jpeg,image/png,image/webp" required></label>
<span class="ayuda">Solo JPEG, PNG o WebP, hasta 5 MB. El SVG no se acepta.</span>
<button class="boton" type="submit">Subir foto</button>
</form>
</section>`
}

export function vistaPlato(
  empleado: Empleado,
  plato: Plato | null,
  categorias: readonly Categoria[],
  puestos: readonly Puesto[],
  iniciales: InicialesPlato,
  estado: EstadoPantalla,
  borrador: BorradorPlato | null = null,
): HtmlSeguro {
  const titulo = plato === null ? "Nuevo plato o bebida" : `Editar: ${plato.nombre}`
  const categoriaDeVuelta = plato?.categoriaId ?? iniciales.categoria
  const destinoDeVuelta =
    categoriaDeVuelta === null ? "/admin/carta" : `/admin/carta/${categoriaDeVuelta}`
  const rotuloDeVuelta = categoriaDeVuelta === null ? "Volver a la carta" : "Volver a la categoría"
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado(estado)}
<section class="tarjeta">
<h1>${titulo}</h1>
${formularioPlato(plato, borrador, categorias, puestos, iniciales)}
</section>
${plato === null ? html`` : seccionFoto(plato)}
<p><a class="boton boton-secundario" href="${destinoDeVuelta}">${rotuloDeVuelta}</a></p>
</main>`
  return pagina(titulo, contenido)
}

// ---------------------------------------------------------------------------
// Los puestos del local: los nombra el dueno (ADR-0034)
// ---------------------------------------------------------------------------

function formularioRenombrarPuesto(puesto: Puesto): HtmlSeguro {
  return html`<form class="renombrar" method="post" action="/admin/puestos/${puesto.id}/renombrar">
<input type="text" name="nombre" value="${puesto.nombre}" maxlength="120" required aria-label="Nuevo nombre del puesto">
<button class="boton-mini" type="submit">Renombrar</button>
</form>`
}

function filaDePuesto(puesto: Puesto, puedeGestionar: boolean): HtmlSeguro {
  const gestion = puedeGestionar
    ? html`${botonesDeOrden(`/admin/puestos/${puesto.id}/mover`)}
${formularioRenombrarPuesto(puesto)}
<form method="post" action="/admin/puestos/${puesto.id}/auto">
<button class="boton-mini" type="submit">${puesto.autoAcepta ? "Pedir aprobación" : "Nacer aceptado"}</button>
</form>
${
  puesto.porDefecto
    ? html`<span class="ayuda">Es el puesto por defecto: no se puede desactivar.</span>`
    : html`<form method="post" action="/admin/puestos/${puesto.id}/alternar">
<button class="boton-mini" type="submit">${puesto.activo ? "Desactivar" : "Activar"}</button>
</form>`
}`
    : html``
  return html`<li class="carta-categoria${puesto.activo ? "" : " carta-oculta"}">
<div class="carta-linea">
<span class="carta-nombre">${puesto.nombre}</span>
${
  puesto.porDefecto
    ? html`<span class="insignia insignia-ok">Por defecto</span>`
    : html`<span class="carta-estado">${puesto.activo ? "Activo" : "Desactivado"}</span>`
}
<span class="carta-estado">${puesto.autoAcepta ? "Nace aceptado" : "Espera aprobación"}</span>
<span class="crece"></span>
${gestion}
</div>
</li>`
}

function formularioNuevoPuesto(): HtmlSeguro {
  return html`<form method="post" action="/admin/puestos">
<label class="campo"><span>Nombre del puesto</span>
<input type="text" name="nombre" maxlength="120" placeholder="Parrilla" required></label>
<label class="casilla"><input type="checkbox" name="auto_acepta" value="1"><span>Nace aceptado, sin aprobación humana</span></label>
<span class="ayuda">Marca esta casilla para una barra o unas bebidas: la comanda entra aceptada. Los puestos de cocina la dejan sin marcar y esperan aprobación.</span>
<button class="boton" type="submit">Crear puesto</button>
</form>`
}

export function vistaPuestos(
  empleado: Empleado,
  puestos: readonly Puesto[],
  puedeGestionar: boolean,
  estado: EstadoPantalla & { readonly creado?: boolean },
): HtmlSeguro {
  const exito = estado.creado === true ? "Puesto creado." : estado.exito
  const lista =
    puestos.length === 0
      ? html`<p>Todavía no hay puestos. Crea el primero arriba.</p>`
      : html`<ul class="carta-lista">${puestos.map((puesto) => filaDePuesto(puesto, puedeGestionar))}</ul>`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Puestos de preparación</h1>
<p>Los puestos los nombras tú, como habla tu gente. Cada pantalla de trabajo muestra uno, y el reparto de la carta va del puesto de la categoría al del plato.</p>
${puedeGestionar ? formularioNuevoPuesto() : html`<p>Puedes consultarlos, pero solo el dueño o el encargado pueden cambiarlos.</p>`}
</section>
<section class="tarjeta">
<h2>Puestos del local</h2>
${lista}
</section>
<p><a class="boton boton-secundario" href="/admin/pedidos">Ver las pantallas de trabajo</a></p>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Puestos", contenido)
}

// ---------------------------------------------------------------------------
// Solicitudes de emparejamiento pendientes
// ---------------------------------------------------------------------------

function etiquetaDeTiempo(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  if (total < 60) {
    return `${total} s`
  }
  return `${Math.round(total / 60)} min`
}

function filaDeSolicitud(solicitud: SolicitudPendiente): HtmlSeguro {
  return html`<li class="pareja">
<span class="pareja-mesa">${solicitud.mesa}</span>
<span class="pareja-tiempo">Pedida hace ${etiquetaDeTiempo(solicitud.pedidaHaceSegundos)} · quedan ${etiquetaDeTiempo(solicitud.restanteSegundos)}</span>
<span class="crece"></span>
<form method="post" action="/admin/parejas/${solicitud.id}/aprobar">
<button class="boton" type="submit">Aprobar</button>
</form>
<form class="pareja-rechazo" method="post" action="/admin/parejas/${solicitud.id}/rechazar">
<input type="text" name="motivo" maxlength="200" placeholder="Motivo del rechazo" aria-label="Motivo del rechazo" required>
<button class="boton boton-secundario" type="submit">Rechazar</button>
</form>
</li>`
}

export function vistaParejas(
  empleado: Empleado,
  solicitudes: readonly SolicitudPendiente[],
  estado: EstadoPantalla & { readonly aprobada?: boolean; readonly rechazada?: boolean },
): HtmlSeguro {
  const exito =
    estado.exito ??
    (estado.aprobada === true
      ? "Solicitud aprobada."
      : estado.rechazada === true
        ? "Solicitud rechazada."
        : undefined)
  const lista =
    solicitudes.length === 0
      ? html`<p>No hay solicitudes pendientes ahora mismo.</p>`
      : html`<ul class="parejas">${solicitudes.map(filaDeSolicitud)}</ul>`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado({ ...estado, exito })}
<section class="tarjeta">
<h1>Solicitudes de emparejamiento</h1>
<p>Un comensal ha escaneado el QR de una mesa. Apruébalo para que pueda pedir. La solicitud tiene diez minutos de ventana desde que la pide; si caduca, el comensal puede volver a pedirla.</p>
${lista}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina("Solicitudes de emparejamiento", contenido)
}

// ---------------------------------------------------------------------------
// Las pantallas de puesto: cocina, barra y todo
// ---------------------------------------------------------------------------

const ETIQUETA_ESTADO_COMANDA: Readonly<Record<EstadoDeComanda, string>> = {
  pendiente: "Nueva",
  aceptada: "Aceptada",
  preparando: "En preparación",
  lista: "Lista",
  servida: "Servida",
  cerrada: "Cobrada",
  anulada: "Anulada",
}

/** Texto del boton: dice a que estado lleva, no el codigo interno. */
const ETIQUETA_DESTINO: Readonly<Record<EstadoDeComanda, string>> = {
  pendiente: "Reabrir",
  aceptada: "Aceptar",
  preparando: "Empezar a preparar",
  lista: "Marcar lista",
  servida: "Marcar servida",
  cerrada: "Cerrar la cuenta",
  anulada: "Anular",
}

/**
 * Destinos que el KDS puede escribir. `cerrada` NO esta: se alcanza tras el cobro (F3), y
 * ofrecerlo aqui abriria una via para cerrar una comanda sin cobrarla (CONTRACT-estados-comanda,
 * regla 6). El resto de destinos son exactamente los de la maquina de estados.
 */
const DESTINOS_DE_ACCION: readonly EstadoDeComanda[] = [
  "aceptada",
  "preparando",
  "lista",
  "servida",
  "anulada",
]

function nombreDePantalla(puesto: PuestoDePantalla, puestos: readonly Puesto[]): string {
  if (esPantallaTodos(puesto)) {
    return "Todos los pedidos"
  }
  return puestos.find((ficha) => ficha.id === puesto)?.nombre ?? "Pedidos"
}

function ayudaDePantalla(puesto: PuestoDePantalla, puestos: readonly Puesto[]): string {
  if (esPantallaTodos(puesto)) {
    return "Todos los puestos juntos, para un local con una sola pantalla."
  }
  return `Solo lo que se prepara en ${nombreDePantalla(puesto, puestos)}.`
}

/** Navegación entre la pantalla de cada puesto del local y la que los muestra todos juntos. */
function navegacionDePuestos(actual: PuestoDePantalla, puestos: readonly Puesto[]): HtmlSeguro {
  const opciones = [
    { id: PANTALLA_TODOS, nombre: "Todo" },
    ...puestos
      .filter((puesto) => puesto.activo)
      .map((puesto) => ({ id: puesto.id, nombre: puesto.nombre })),
  ]
  return html`<nav class="puestos">${opciones.map((opcion) =>
    opcion.id === actual
      ? html`<span class="puesto-actual" aria-current="page">${opcion.nombre}</span>`
      : html`<a class="puesto-enlace" href="/admin/pedidos/${opcion.id}">${opcion.nombre}</a>`,
  )}</nav>`
}

function accionDeEstado(
  comandaId: string,
  destino: EstadoDeComanda,
  puesto: PuestoDePantalla,
): HtmlSeguro {
  const clase = destino === "anulada" ? "boton-mini boton-anular" : "boton-mini"
  return html`<form method="post" action="/admin/pedidos/${comandaId}/estado">
<input type="hidden" name="destino" value="${destino}">
<input type="hidden" name="puesto" value="${puesto}">
<button class="${clase}" type="submit">${ETIQUETA_DESTINO[destino]}</button>
</form>`
}

/**
 * Una comanda de un puesto. NO lleva importes: quien prepara no cobra. Una comanda recien
 * enviada se marca con acento para que salte a la vista, sea de cocina o de barra.
 */
function comandaDePuesto(comanda: ComandaDePuesto, puesto: PuestoDePantalla): HtmlSeguro {
  const destinos = estadosPermitidos(comanda.estado).filter((destino) =>
    DESTINOS_DE_ACCION.includes(destino),
  )
  const nueva = comanda.creadaHaceSegundos <= 120
  const pendiente = comanda.estado === "pendiente"
  return html`<li class="pedido-cocina pedido-cocina-${comanda.estado}${nueva ? " pedido-cocina-nueva" : ""}">
<div class="pedido-cabecera">
<span class="pedido-mesa">${comanda.mesa}</span>
<span class="pedido-destino">${comanda.destino}</span>
<span class="pedido-estado pedido-estado-${comanda.estado}">${ETIQUETA_ESTADO_COMANDA[comanda.estado]}</span>
<span class="pedido-tiempo">hace ${etiquetaDeTiempo(comanda.creadaHaceSegundos)}</span>
</div>
${pendiente ? html`<p class="pedido-nueva" role="status">Comanda nueva: todavía no la ha aceptado nadie.</p>` : html``}
<ul class="pedido-lineas">${comanda.lineas.map(
    (linea) => html`<li><span>${linea.cantidad}× ${linea.nombre}</span></li>`,
  )}</ul>
<div class="pedido-acciones">${destinos.map((destino) => accionDeEstado(comanda.id, destino, puesto))}</div>
</li>`
}

export function vistaCocina(
  empleado: Empleado,
  comandas: readonly ComandaDePuesto[],
  puesto: PuestoDePantalla,
  puestos: readonly Puesto[],
  estado: EstadoPantalla,
  solicitudes: readonly EmparejamientoPendiente[] = [],
): HtmlSeguro {
  const titulo = nombreDePantalla(puesto, puestos)
  const lista =
    comandas.length === 0
      ? html`<p>No hay pedidos abiertos ahora mismo.</p>`
      : html`<ul class="pedidos-cocina">${comandas.map((comanda) => comandaDePuesto(comanda, puesto))}</ul>`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado(estado)}
${avisoDeEmparejamientos(solicitudes, `/admin/pedidos/${puesto}`)}
<section class="tarjeta">
<h1>${titulo}</h1>
${navegacionDePuestos(puesto, puestos)}
<p>${ayudaDePantalla(puesto, puestos)} Esta pantalla se actualiza sola cada 15 segundos y las comandas nuevas aparecen marcadas.</p>
${lista}
</section>
${enlaceVolverAlPanel()}
</main>`
  return pagina(titulo, contenido, 15)
}
