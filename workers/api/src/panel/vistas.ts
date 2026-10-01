/**
 * Pantallas del armazón: entrada, cuadro y permiso denegado.
 *
 * Nada de gestión todavía: el cuadro solo presenta a quién eres y el hueco de lo que vendrá.
 * Todo el HTML se construye con la plantilla que escapa por defecto; ningún dato de la base
 * se escribe sin pasar por ella.
 */
import type { Empleado } from "../base.ts"
import { type HtmlSeguro, html, htmlCrudo } from "../ui/html.ts"
import { generarQrSvg } from "../ui/qr.ts"
import {
  ALERGENOS,
  ESTACIONES,
  etiquetaDe,
  type Opcion,
  SIN_CATEGORIA,
  TAGS,
} from "./carta-catalogo.ts"
import type { Categoria, DatosLocal, Mesa, Plato, Zona } from "./datos.ts"
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
    { titulo: "Alta del local (asistente)" },
    { titulo: "Carta (categorías, platos, precios, fotos, orden)", href: "/admin/carta" },
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
  readonly estacion: string
  readonly disponible: boolean
  readonly activo: boolean
  readonly desde: string
  readonly hasta: string
  readonly orden: string
  readonly tags: readonly string[]
  readonly allergens: readonly string[]
}

/** Con qué se abre el formulario de alta: categoría y estación ya elegidas. */
export type InicialesPlato = {
  readonly categoria: string | null
  readonly estacion: string | null
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
  return `/admin/carta/plato?estacion=bar&bebida=1${sufijo}`
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

function filaDeCategoria(categoria: Categoria, puedeGestionar: boolean): HtmlSeguro {
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
<span class="crece"></span>
${gestion}
</div>
</li>`
}

function listaDeCategorias(categorias: readonly Categoria[], puedeGestionar: boolean): HtmlSeguro {
  if (categorias.length === 0) {
    return html`<p>Todavía no hay categorías. Crea la primera arriba.</p>`
  }
  return html`<ul class="carta-lista">${categorias.map((categoria) => filaDeCategoria(categoria, puedeGestionar))}</ul>`
}

export function vistaCarta(
  empleado: Empleado,
  categorias: readonly Categoria[],
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
${listaDeCategorias(categorias, puedeGestionar)}
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

function filaDePlato(plato: Plato, puedeGestionar: boolean): HtmlSeguro {
  const detalles = plato.estacion === null ? "" : ` · ${etiquetaDe(ESTACIONES, plato.estacion)}`
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

function listaDePlatos(platos: readonly Plato[], puedeGestionar: boolean): HtmlSeguro {
  if (platos.length === 0) {
    return html`<p>Todavía no hay platos ni bebidas en esta categoría.</p>`
  }
  return html`<ul class="carta-lista">${platos.map((plato) => filaDePlato(plato, puedeGestionar))}</ul>`
}

export function vistaCategoria(
  empleado: Empleado,
  categoria: Categoria,
  platos: readonly Plato[],
  puedeGestionar: boolean,
  estado: EstadoPantalla,
): HtmlSeguro {
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
<h2>Platos y bebidas</h2>
${listaDePlatos(platos, puedeGestionar)}
</section>
</main>`
  return pagina(categoria.nombre, contenido)
}

function campoSeleccion(
  etiqueta: string,
  nombre: string,
  actual: string | null,
  opciones: readonly Opcion[],
  vacio: string,
): HtmlSeguro {
  return html`<label class="campo"><span>${etiqueta}</span>
<select name="${nombre}">${opcionesDeCatalogo(opciones, actual, vacio)}</select></label>`
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

function estacionDeBorrador(valor: string): string | null {
  return valor === "" ? null : valor
}

/** El campo de foto del alta: opcional, y se valida antes de crear nada (mensaje en el formulario). */
function campoFotoNueva(): HtmlSeguro {
  return html`<fieldset class="grupo">
<legend>Foto</legend>
<label class="campo"><span>Foto del plato (opcional)</span>
<input type="file" name="foto" accept="image/jpeg,image/png,image/webp"></label>
<span class="ayuda">Solo JPEG, PNG o WebP, hasta 5 MB. El SVG no se acepta. Si la foto no vale, no se crea el plato y no pierdes lo que escribiste.</span>
</fieldset>`
}

function avisoSinCategoriaDeBebidas(): HtmlSeguro {
  return html`<p class="aviso aviso-aviso" role="status">Todavía no tienes una categoría de bebidas. Puedes guardar la bebida sin categoría o <a href="/admin/carta">crear antes la categoría en «Carta»</a>.</p>`
}

function formularioPlato(
  plato: Plato | null,
  borrador: BorradorPlato | null,
  categorias: readonly Categoria[],
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
  const estacion =
    borrador !== null
      ? estacionDeBorrador(borrador.estacion)
      : (plato?.estacion ?? iniciales.estacion)
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
${campoSeleccion("Estación de preparación", "estacion", estacion, ESTACIONES, "Sin estación")}
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
<button class="boton" type="submit">Crear plato</button>
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
  iniciales: InicialesPlato,
  estado: EstadoPantalla,
  borrador: BorradorPlato | null = null,
): HtmlSeguro {
  const titulo = plato === null ? "Nuevo plato o bebida" : `Editar: ${plato.nombre}`
  const contenido = html`${cabecera("admin", empleado)}
<main class="contenedor">
${avisosDeEstado(estado)}
<section class="tarjeta">
<h1>${titulo}</h1>
${formularioPlato(plato, borrador, categorias, iniciales)}
</section>
${plato === null ? html`` : seccionFoto(plato)}
<p><a class="boton boton-secundario" href="/admin/carta${
    plato?.categoriaId === null || plato?.categoriaId === undefined ? "" : `/${plato.categoriaId}`
  }">Volver a la categoría</a></p>
</main>`
  return pagina(titulo, contenido)
}
