/**
 * Pantallas publicas del comensal: la carta de su mesa y el estado del emparejamiento.
 *
 * Se dibujan en el servidor y SIN JavaScript (el CSP no lo permite): el comensal refresca a
 * mano. En el estado "esperando" se anade un unico `<meta http-equiv="refresh">` a 10 s para
 * no tener que refrescar a mano mientras el local decide; esta declarado a proposito.
 *
 * Todo dato que viene de la base pasa por la plantilla que escapa por defecto: el nombre del
 * local y de los platos son datos del establecimiento, no de una persona, pero un nombre con
 * etiquetas no puede convertirse en ejecucion en el navegador del comensal.
 */

import { totalDeLineas } from "@camarero/domain"
import { type HtmlSeguro, html } from "../ui/html.ts"
import type { LineaResuelta } from "./cesta.ts"
import type {
  CartaDelComensal,
  CategoriaDeCarta,
  IdentidadDelLocal,
  PedidoDelComensal,
  PlatoDeCarta,
} from "./datos.ts"

const FORMATO_CLP = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

/**
 * Ruta del tema del comensal. La hoja general (`/panel/estilos.css`) usa el modelo por defecto;
 * esta la genera el borde con el modelo y el acento DEL LOCAL (ADR-0035), de modo que cambiar
 * la identidad no toca codigo. Se sirve por GET y sin sesion.
 */
export function rutaDelTema(codigo: string): string {
  return `/t/${encodeURIComponent(codigo)}/tema.css`
}

/** Identificador estable de una categoria para las pildoras y los anclajes de salto. */
function anclaDeCategoria(categoria: CategoriaDeCarta, indice: number): string {
  return categoria.id === "" ? `categoria-${indice}` : `cat-${categoria.id}`
}

/**
 * Cada cuanto se repinta la pantalla del comensal mientras hay algo que contar.
 *
 * Se piensa en un movil con datos: durante el emparejamiento la ventana es corta y la
 * respuesta importa, asi que se refresca cada 10 s; mientras hay comandas sin servir se usa
 * el mismo ritmo que las pantallas de cocina y barra (15 s), suficiente para que el comensal
 * vea cambiar el estado casi al mismo tiempo que el personal y la mitad de agresivo que un
 * refresco de 10 s sobre una bateria y una tarifa movil. Cuando no queda nada en marcha la
 * pantalla NO se refresca: no hay nada que contar.
 */
const REFRESCO_ESPERANDO_APROBACION = 10
const REFRESCO_PEDIDOS_EN_MARCHA = 15

function precio(clp: number): string {
  return `$ ${FORMATO_CLP.format(clp)}`
}

/**
 * La cabecera del comensal con la franja del gasto (D-056) y la identidad del local.
 *
 * Va en todas las pantallas donde ya hay mesa —la carta, la cesta, los pedidos y el estado del
 * emparejamiento— y NO en las que dicen que no hay mesa. Cuando no se ha pedido nada no se
 * escribe «$ 0», que parece una franja rota: se dice que aún no hay nada pedido.
 */
function cabeceraComensal(
  local: string,
  codigo: string,
  identidad: IdentidadDelLocal,
  subtotalAcumuladoClp: number,
  enElDesglose: boolean,
): HtmlSeguro {
  const logo =
    identidad.logoClave === null
      ? html``
      : html`<img class="comensal-logo" src="/cartas/${identidad.logoClave}" alt="" loading="lazy">`
  // El nombre visible del sistema va delante del del local; el logo, si lo hay, a la izquierda.
  const marca = html`${logo}<span class="marca">Camarero</span>
<span class="comensal-local">${local}</span>`
  if (subtotalAcumuladoClp === 0) {
    return html`<header class="comensal-cabecera">
${marca}
<p class="comensal-gasto comensal-gasto-vacio">Todavía no has pedido nada en esta mesa.</p>
</header>`
  }
  const enlace = enElDesglose
    ? html`<a class="boton-mini" href="/t/${codigo}">Volver a la carta</a>`
    : html`<a class="boton-mini" href="/t/${codigo}/pedidos">Ver el desglose</a>`
  return html`<header class="comensal-cabecera">
${marca}
<p class="comensal-gasto">
<span class="comensal-gasto-etiqueta">Llevas gastado</span>
<strong>${precio(subtotalAcumuladoClp)}</strong>
${enlace}
</p>
</header>`
}

function paginaComensal(
  titulo: string,
  contenido: HtmlSeguro,
  refrescoSegundos: number | null,
  tema: { readonly codigo: string; readonly identidad: IdentidadDelLocal } | null,
): HtmlSeguro {
  const metaRefresco =
    refrescoSegundos === null
      ? html``
      : html`<meta http-equiv="refresh" content="${refrescoSegundos}">`
  // Con el codigo de mesa, la hoja propia del tema del local cambia por modelo y acento; sin
  // el (pantallas de error), la hoja general del sistema. Nunca se escribe un color a mano.
  const hojaDeEstilos =
    tema === null
      ? html`<link rel="stylesheet" href="/panel/estilos.css">`
      : html`<link rel="stylesheet" href="/panel/estilos.css">
<link rel="stylesheet" href="${rutaDelTema(tema.codigo)}">`
  return html`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Camarero</title>
${metaRefresco}
${hojaDeEstilos}
</head>
<body class="comensal">
${contenido}
</body>
</html>`
}

/** La ventana dura diez minutos: se enseña en minutos, no en un numero crudo de segundos. */
function tiempoRestante(segundos: number): string {
  const total = Math.max(0, Math.round(segundos))
  return total < 60 ? `${total} segundos` : `${Math.ceil(total / 60)} minutos`
}

function bloqueEmparejamiento(carta: CartaDelComensal, codigo: string): HtmlSeguro {
  const accion = `/t/${codigo}/pareja`
  if (carta.estado === "aprobado") {
    return html`<div class="emparejamiento emparejamiento-ok" role="status">
<p><strong>Ya puedes pedir.</strong> El local ha aprobado tu mesa.</p>
</div>`
  }
  if (carta.estado === "esperando") {
    const quedan =
      carta.restanteSegundos === null
        ? html``
        : html`<p class="ayuda">Quedan unos ${tiempoRestante(carta.restanteSegundos)}.</p>`
    return html`<div class="emparejamiento emparejamiento-espera" role="status">
<p><strong>Esperando que el local lo apruebe.</strong></p>
<p>Si tarda, avisa a quien te atiende. Esta pantalla se actualiza sola.</p>
${quedan}
</div>`
  }
  if (carta.estado === "rechazado") {
    return html`<div class="emparejamiento emparejamiento-error" role="alert">
<p>El local no ha aprobado el acceso a esta mesa.</p>
<form method="post" action="${accion}">
<button class="boton boton-grande" type="submit">Volver a pedir</button>
</form>
</div>`
  }
  if (carta.estado === "caducado") {
    return html`<div class="emparejamiento emparejamiento-error" role="alert">
<p>Tu solicitud ha caducado, pero no pasa nada: puedes pedirla otra vez.</p>
<form method="post" action="${accion}">
<button class="boton boton-grande" type="submit">Volver a pedir</button>
</form>
</div>`
  }
  return html`<div class="emparejamiento">
<p>Pide emparejarte para que el local sepa que estás en esta mesa.</p>
<form method="post" action="${accion}">
<button class="boton boton-grande" type="submit">Pedir emparejarse</button>
</form>
</div>`
}

/**
 * Pedir la cuenta: un POST y una sola vez. Cuando ya esta pedida se dice con claridad y no se
 * ofrece el boton. La barra de verdad esta en la base (no se puede insertar una comanda con
 * una cuenta viva), pero la pantalla no debe mentir ofreciendo lo que la base rechazara.
 */
function bloqueCuenta(codigo: string, cuentaPedida: boolean): HtmlSeguro {
  if (cuentaPedida) {
    return html`<div class="cuenta-pedida" role="status">
<p><strong>Has pedido la cuenta.</strong> El local la está preparando. Ya no se pueden añadir más platos a esta mesa.</p>
</div>`
  }
  return html`<div class="cuenta-pedir">
<p>¿Habéis terminado? Pídele la cuenta al local desde aquí.</p>
<form method="post" action="/t/${codigo}/cuenta">
<button class="boton boton-grande" type="submit">Pedir la cuenta</button>
</form>
</div>`
}

/**
 * Añadir a la cesta es un POST sin JavaScript. El boton es GRANDE y de PULGAR (D-057): el
 * comensal pide con una mano y con mala luz, asi que el objetivo no puede ser un enlace pequeño.
 * Es un boton de ancho comodo y altura de pulgar, no una x minima.
 */
function botonAgregar(plato: PlatoDeCarta, codigo: string): HtmlSeguro {
  return html`<form class="comensal-agregar" method="post" action="/t/${codigo}/cesta">
<input type="hidden" name="plato" value="${plato.id}">
<input type="hidden" name="cantidad" value="1">
<button class="boton comensal-agregar-boton" type="submit" aria-label="Añadir ${plato.nombre} a la cesta">
<span class="comensal-agregar-signo" aria-hidden="true">+</span> Añadir
</button>
</form>`
}

function fichaDePlato(plato: PlatoDeCarta, codigo: string, puedeAnadir: boolean): HtmlSeguro {
  const foto =
    plato.fotoClave === null
      ? html`<span class="comensal-foto comensal-foto-vacia" aria-hidden="true"></span>`
      : html`<img class="comensal-foto" src="/cartas/${plato.fotoClave}" alt="Foto de ${plato.nombre}" loading="lazy">`
  const descripcion =
    plato.descripcion === null
      ? html``
      : html`<span class="comensal-plato-desc">${plato.descripcion}</span>`
  return html`<li class="comensal-plato">
${foto}
<span class="comensal-plato-texto">
<span class="comensal-plato-nombre">${plato.nombre}</span>
${descripcion}
<span class="comensal-plato-precio">${precio(plato.precioClp)}</span>
</span>
${puedeAnadir ? botonAgregar(plato, codigo) : html``}
</li>`
}

function seccionDeCategoria(
  categoria: CategoriaDeCarta,
  indice: number,
  codigo: string,
  puedeAnadir: boolean,
): HtmlSeguro {
  return html`<section class="comensal-categoria" id="${anclaDeCategoria(categoria, indice)}">
<h2 class="comensal-categoria-titulo">${categoria.nombre}</h2>
<ul class="comensal-platos">${categoria.platos.map((plato) => fichaDePlato(plato, codigo, puedeAnadir))}</ul>
</section>`
}

/**
 * Las categorias como PILDORAS para saltar (D-057): el comensal ve de un vistazo que hay y
 * toca para ir. Son enlaces de ancla, sin JavaScript, y se desplazan en horizontal si no caben.
 */
function pildorasDeCategoria(categorias: readonly CategoriaDeCarta[]): HtmlSeguro {
  if (categorias.length === 0) {
    return html``
  }
  return html`<nav class="comensal-pildoras" aria-label="Categorías de la carta">
${categorias.map(
  (categoria, indice) =>
    html`<a class="comensal-pildora" href="#${anclaDeCategoria(categoria, indice)}">${categoria.nombre}</a>`,
)}
</nav>`
}

/**
 * Los dos avisos al personal (TASK-F1-13): llamar a un empleado y avisar de la limpieza.
 * Cuando ya se han pedido, se dice —con su tipo— en lugar de ofrecer el boton otra vez: el
 * comensal VE que lo ha pedido. La frase es distinta por tipo y nunca promete mas de lo que hay.
 */
const ETIQUETA_DE_AVISO: Readonly<Record<string, string>> = {
  llamar_empleado: "Has llamado a un empleado",
  necesita_limpieza: "Has avisado de que la mesa necesita limpieza",
}

const BOTON_DE_AVISO: Readonly<Record<string, string>> = {
  llamar_empleado: "Llamar a un empleado",
  necesita_limpieza: "La mesa necesita limpieza",
}

function bloqueAvisos(carta: CartaDelComensal, codigo: string): HtmlSeguro {
  if (carta.estado !== "aprobado") {
    return html``
  }
  const vivos = new Set(carta.avisos.map((aviso) => aviso.tipo))
  const boton = (tipo: string): HtmlSeguro =>
    vivos.has(tipo as "llamar_empleado" | "necesita_limpieza")
      ? html`<p class="comensal-aviso-hecho" role="status">${ETIQUETA_DE_AVISO[tipo]}. Enseguida viene alguien.</p>`
      : html`<form method="post" action="/t/${codigo}/avisar">
<input type="hidden" name="tipo" value="${tipo}">
<button class="boton boton-secundario comensal-aviso-boton" type="submit">${BOTON_DE_AVISO[tipo]}</button>
</form>`
  return html`<div class="comensal-avisos">
<p class="comensal-avisos-titulo">¿Necesitas algo?</p>
${boton("llamar_empleado")}
${boton("necesita_limpieza")}
</div>`
}

export function vistaCartaComensal(
  carta: CartaDelComensal,
  codigo: string,
  cantidadCesta = 0,
): HtmlSeguro {
  const cartaVacia =
    carta.categorias.length === 0
      ? html`<p>Todavía no hay nada publicado en la carta de este local.</p>`
      : html``
  const resumenCesta =
    cantidadCesta > 0
      ? html`<p class="comensal-cesta-aviso"><a class="boton" href="/t/${codigo}/cesta">Ver mi cesta (${cantidadCesta} ${cantidadCesta === 1 ? "plato" : "platos"})</a></p>`
      : html``
  // La portada del local, si la tiene: es la entrada bonita de la carta.
  const portada =
    carta.identidad.portadaClave === null
      ? html``
      : html`<img class="comensal-portada" src="/cartas/${carta.identidad.portadaClave}" alt="Portada de ${carta.local}" loading="lazy">`
  const contenido = html`${cabeceraComensal(carta.local, codigo, carta.identidad, carta.subtotalAcumuladoClp, false)}
<main class="contenedor comensal-principal">
${portada}
<h1 class="comensal-mesa">${carta.mesa}</h1>
${bloqueEmparejamiento(carta, codigo)}
${bloqueAvisos(carta, codigo)}
${carta.estado === "aprobado" ? bloqueCuenta(codigo, carta.cuentaPedida) : html``}
${resumenCesta}
<h2 class="comensal-carta-titulo">Carta</h2>
${pildorasDeCategoria(carta.categorias)}
${cartaVacia}
${carta.categorias.map((categoria, indice) => seccionDeCategoria(categoria, indice, codigo, !carta.cuentaPedida))}
</main>`
  return paginaComensal(
    carta.mesa,
    contenido,
    carta.estado === "esperando" ? REFRESCO_ESPERANDO_APROBACION : null,
    { codigo, identidad: carta.identidad },
  )
}

// ---------------------------------------------------------------------------
// La cesta y el estado de los pedidos
// ---------------------------------------------------------------------------

const ETIQUETA_ESTADO_PEDIDO: Readonly<Record<string, string>> = {
  pendiente: "Enviado, esperando que lo acepten",
  aceptada: "Aceptado por el local",
  preparando: "En preparación",
  lista: "Listo para servir",
  servida: "Servido en tu mesa",
  cerrada: "Cuenta cerrada",
  anulada: "Anulado por el local",
}

function insigniaDeEstado(estado: string): HtmlSeguro {
  return html`<span class="pedido-estado pedido-estado-${estado}">${ETIQUETA_ESTADO_PEDIDO[estado] ?? estado}</span>`
}

/**
 * Una comanda sigue "en marcha" mientras no haya terminado. Solo entonces hay algo que
 * contar y la pantalla se refresca; con todo servido (o anulado) deja de refrescarse (D-055).
 */
const ESTADOS_TERMINADOS: ReadonlySet<string> = new Set(["servida", "cerrada", "anulada"])

function enMarcha(pedido: PedidoDelComensal): boolean {
  return !ESTADOS_TERMINADOS.has(pedido.estado)
}

/** Los tres controles de una linea: subir, bajar y quitar, cada uno su POST. */
function controlesDeLinea(platoId: string, codigo: string): HtmlSeguro {
  const boton = (accion: string, texto: string, etiqueta: string): HtmlSeguro =>
    html`<form method="post" action="/t/${codigo}/cesta/linea">
<input type="hidden" name="plato" value="${platoId}">
<input type="hidden" name="accion" value="${accion}">
<button class="boton-mini" type="submit" aria-label="${etiqueta}">${texto}</button>
</form>`
  return html`<span class="cesta-controles">
${boton("bajar", "−", "Bajar cantidad")}
${boton("subir", "+", "Subir cantidad")}
${boton("quitar", "Quitar", "Quitar de la cesta")}
</span>`
}

function filaDeCesta(linea: LineaResuelta, codigo: string): HtmlSeguro {
  return html`<li class="cesta-linea">
<span class="cesta-nombre">${linea.nombre}
<span class="cesta-unitario">${precio(linea.precioClp)} por unidad</span>
</span>
<span class="cesta-cantidad">×${linea.cantidad}</span>
<span class="cesta-subtotal">${precio(linea.totalClp)}</span>
${controlesDeLinea(linea.platoId, codigo)}
</li>`
}

function avisoAntesDeEnviar(): HtmlSeguro {
  return html`<p class="aviso aviso-aviso cesta-aviso" role="alert">Tu pedido va <strong>por partes</strong>: la cocina y la barra lo preparan por separado. En cuanto pulses «Enviar la comanda» <strong>no se deshace sola</strong>: si algo no está bien, avisa a quien te atiende.</p>`
}

export type OpcionesDeCesta = {
  readonly clave: string
  readonly puedeEnviar: boolean
  readonly aviso?: string
}

/** La cesta: lineas con cantidad y controles, total y el aviso inequivoco antes de enviar. */
export function vistaCestaComensal(
  carta: CartaDelComensal,
  codigo: string,
  lineas: readonly LineaResuelta[],
  totalClp: number,
  opciones: OpcionesDeCesta,
): HtmlSeguro {
  const cabecera = cabeceraComensal(
    carta.local,
    codigo,
    carta.identidad,
    carta.subtotalAcumuladoClp,
    false,
  )
  if (lineas.length === 0) {
    const contenido = html`${cabecera}
<main class="contenedor">
<h1 class="comensal-mesa">Tu cesta</h1>
${opciones.aviso === undefined ? html`` : html`<p class="aviso aviso-aviso" role="alert">${opciones.aviso}</p>`}
<section class="tarjeta">
<p>Tu cesta está vacía.</p>
<p><a class="boton boton-secundario" href="/t/${codigo}">Volver a la carta</a></p>
</section>
</main>`
    return paginaComensal("Tu cesta", contenido, null, { codigo, identidad: carta.identidad })
  }
  const enviar = opciones.puedeEnviar
    ? html`<form method="post" action="/t/${codigo}/cesta/enviar">
<input type="hidden" name="clave" value="${opciones.clave}">
<button class="boton boton-grande" type="submit">Enviar la comanda</button>
</form>`
    : carta.cuentaPedida
      ? html`<div class="cesta-bloqueo">
<p><strong>Has pedido la cuenta.</strong> No puedes enviar más platos a esta mesa.</p>
</div>`
      : html`<div class="cesta-bloqueo">
<p>Para enviar, el local tiene que aprobar tu mesa. Pídeselo desde aquí:</p>
${bloqueEmparejamiento(carta, codigo)}
</div>`
  const contenido = html`${cabecera}
<main class="contenedor">
<h1 class="comensal-mesa">Tu cesta</h1>
${opciones.aviso === undefined ? html`` : html`<p class="aviso aviso-aviso" role="alert">${opciones.aviso}</p>`}
<ul class="cesta-lista">${lineas.map((linea) => filaDeCesta(linea, codigo))}</ul>
<p class="cesta-total"><span>Total</span> <strong>${precio(totalClp)}</strong></p>
${opciones.puedeEnviar ? avisoAntesDeEnviar() : html``}
${enviar}
<p><a class="boton boton-secundario" href="/t/${codigo}">Seguir pidiendo</a></p>
</main>`
  return paginaComensal("Tu cesta", contenido, null, { codigo, identidad: carta.identidad })
}

/**
 * Explica el resumen sin mentir: si no queda nada vivo es porque todo se anulo, no porque
 * este servido. Si no hay nada anulado y nada por llegar, entonces si esta todo servido.
 */
function mensajeDeCuenta(subtotalAcumuladoClp: number, pendienteDeLlegarClp: number): string {
  if (subtotalAcumuladoClp === 0) {
    return "Todo lo que pediste en esta mesa quedó anulado."
  }
  if (pendienteDeLlegarClp === 0) {
    return "Ya está servido todo lo que has pedido."
  }
  return "«Llevas pedido» es todo lo que has pedido y sigue vivo; «aún no ha llegado» es lo que queda por servirte."
}

/** El resumen de la mesa: cuanto se lleva pedido y cuanto queda por llegar, sin lo anulado. */
function resumenDeCuenta(subtotalAcumuladoClp: number, pendienteDeLlegarClp: number): HtmlSeguro {
  return html`<section class="tarjeta pedido-cuenta">
<h2>Lo que llevas en esta mesa</h2>
<p class="pedido-acumulado"><span>Llevas pedido</span> <strong>${precio(subtotalAcumuladoClp)}</strong></p>
<p class="pedido-pendiente"><span>Aún no ha llegado</span> <strong>${precio(pendienteDeLlegarClp)}</strong></p>
<p class="ayuda">${mensajeDeCuenta(subtotalAcumuladoClp, pendienteDeLlegarClp)}</p>
</section>`
}

/** Una comanda del comensal: en que va, de donde sale y cuanto suma. */
function pedidoComensal(pedido: PedidoDelComensal): HtmlSeguro {
  return html`<section class="tarjeta pedido-comensal">
<h2>${insigniaDeEstado(pedido.estado)}</h2>
<p class="pedido-destino">Se prepara en: <strong>${pedido.destino}</strong></p>
<ul class="pedido-lineas">${pedido.lineas.map(
    (linea) =>
      html`<li><span>${linea.cantidad}× ${linea.nombre}</span><span>${precio(linea.totalClp)}</span></li>`,
  )}</ul>
<p class="pedido-total"><span>Total de esta comanda</span> <strong>${precio(pedido.totalClp)}</strong></p>
</section>`
}

/**
 * Estado de los pedidos del comensal: cuanto lleva pedido, cuanto falta por llegar y en que
 * va cada comanda. Se refresca solo mientras haya algo en marcha (D-055); con todo servido
 * deja de refrescarse porque ya no hay nada que contar.
 */
export function vistaPedidosComensal(
  local: string,
  mesa: string,
  codigo: string,
  pedidos: readonly PedidoDelComensal[],
  subtotalAcumuladoClp: number,
  cuentaPedida = false,
  identidad: IdentidadDelLocal = {
    modelo: "sobrio",
    acento: null,
    logoClave: null,
    portadaClave: null,
  },
): HtmlSeguro {
  const hayEnMarcha = pedidos.some(enMarcha)
  // Lo que aun no ha llegado, con la MISMA funcion de totales del dominio que el resto.
  const pendienteDeLlegarClp = totalDeLineas(pedidos.filter(enMarcha))
  const avisoHermanas =
    pedidos.length >= 2
      ? html`<p class="aviso aviso-aviso">Tu pedido va por partes: la cocina y la barra lo preparan por separado. Por eso ves más de una comanda; cada una avanza a su ritmo.</p>`
      : html``
  const lista =
    pedidos.length === 0
      ? html`<section class="tarjeta"><p>Todavía no has enviado ninguna comanda.</p></section>`
      : html`${resumenDeCuenta(subtotalAcumuladoClp, pendienteDeLlegarClp)}${pedidos.map(pedidoComensal)}`
  const contenido = html`${cabeceraComensal(local, codigo, identidad, subtotalAcumuladoClp, true)}
<main class="contenedor">
<h1 class="comensal-mesa">Tus pedidos · ${mesa}</h1>
<p class="ayuda">${
    hayEnMarcha
      ? "Esta pantalla se actualiza sola mientras quede algo en marcha."
      : "Ya no queda nada en marcha: esta pantalla no necesita actualizarse."
  }</p>
${avisoHermanas}
${lista}
${bloqueCuenta(codigo, cuentaPedida)}
<p><a class="boton boton-secundario" href="/t/${codigo}">Volver a la carta</a></p>
</main>`
  return paginaComensal("Tus pedidos", contenido, hayEnMarcha ? REFRESCO_PEDIDOS_EN_MARCHA : null, {
    codigo,
    identidad,
  })
}

/** El dispositivo no tiene una sesion de esta mesa: hay que volver a escanear el QR. */
export function vistaSinSesion(): HtmlSeguro {
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
</header>
<main class="contenedor">
<section class="tarjeta">
<h1>No encontramos tu mesa</h1>
<p>Este dispositivo ya no tiene una sesión de mesa abierta. Vuelve a escanear el QR de tu mesa.</p>
</section>
</main>`
  return paginaComensal("Mesa no encontrada", contenido, null, null)
}

/**
 * La sesion de esta mesa se cerro: el identificador ya no vale. Hay que escanear el QR otra
 * vez para abrir una sesion nueva, que empieza limpia.
 */
export function vistaSesionCerrada(): HtmlSeguro {
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
</header>
<main class="contenedor">
<section class="tarjeta">
<h1>La cuenta de esta mesa se cerró</h1>
<p>Esta mesa ya terminó su servicio. Vuelve a escanear el QR de tu mesa para empezar de nuevo.</p>
<p>Si acabas de sentarte, pide al personal que abra la mesa.</p>
</section>
</main>`
  return paginaComensal("Mesa cerrada", contenido, null, null)
}

export function vistaLocalInactivo(): HtmlSeguro {
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
</header>
<main class="contenedor">
<section class="tarjeta">
<h1>Este local todavía no está tomando pedidos</h1>
<p>Tu enlace es correcto, pero el local no está abierto. Avísale al personal.</p>
<p>Vuelve a escanear el QR de tu mesa cuando te atiendan.</p>
</section>
</main>`
  return paginaComensal("Local sin abrir", contenido, null, null)
}

export function vistaCodigoDesconocido(): HtmlSeguro {
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
</header>
<main class="contenedor">
<section class="tarjeta">
<h1>Este código no corresponde a ninguna mesa</h1>
<p>Comprueba que has escaneado el QR de tu mesa, o pide ayuda a quien te atiende.</p>
<p>Si escribiste el código a mano, revisa que no te falte ningún carácter.</p>
</section>
</main>`
  return paginaComensal("Código no encontrado", contenido, null, null)
}
