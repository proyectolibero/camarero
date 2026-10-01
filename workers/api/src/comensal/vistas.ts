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
  PedidoDelComensal,
  PlatoDeCarta,
} from "./datos.ts"

const FORMATO_CLP = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

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

function paginaComensal(
  titulo: string,
  contenido: HtmlSeguro,
  refrescoSegundos: number | null,
): HtmlSeguro {
  const metaRefresco =
    refrescoSegundos === null
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

/** Añadir a la cesta es un POST sin JavaScript: cada plato lleva su boton y su accion. */
function botonAgregar(plato: PlatoDeCarta, codigo: string): HtmlSeguro {
  return html`<form class="comensal-agregar" method="post" action="/t/${codigo}/cesta">
<input type="hidden" name="plato" value="${plato.id}">
<input type="hidden" name="cantidad" value="1">
<button class="boton-mini" type="submit">Añadir</button>
</form>`
}

function fichaDePlato(plato: PlatoDeCarta, codigo: string): HtmlSeguro {
  const foto =
    plato.fotoClave === null
      ? html``
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
${botonAgregar(plato, codigo)}
</li>`
}

function seccionDeCategoria(categoria: CategoriaDeCarta, codigo: string): HtmlSeguro {
  return html`<section class="comensal-categoria">
<h2>${categoria.nombre}</h2>
<ul class="comensal-platos">${categoria.platos.map((plato) => fichaDePlato(plato, codigo))}</ul>
</section>`
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
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
<span class="comensal-local">${carta.local}</span>
</header>
<main class="contenedor">
<h1 class="comensal-mesa">${carta.mesa}</h1>
${bloqueEmparejamiento(carta, codigo)}
${resumenCesta}
<h2 class="comensal-carta-titulo">Carta</h2>
${cartaVacia}
${carta.categorias.map((categoria) => seccionDeCategoria(categoria, codigo))}
</main>`
  return paginaComensal(
    carta.mesa,
    contenido,
    carta.estado === "esperando" ? REFRESCO_ESPERANDO_APROBACION : null,
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
  const cabecera = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
<span class="comensal-local">${carta.local}</span>
</header>`
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
    return paginaComensal("Tu cesta", contenido, null)
  }
  const enviar = opciones.puedeEnviar
    ? html`<form method="post" action="/t/${codigo}/cesta/enviar">
<input type="hidden" name="clave" value="${opciones.clave}">
<button class="boton boton-grande" type="submit">Enviar la comanda</button>
</form>`
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
${avisoAntesDeEnviar()}
${enviar}
<p><a class="boton boton-secundario" href="/t/${codigo}">Seguir pidiendo</a></p>
</main>`
  return paginaComensal("Tu cesta", contenido, null)
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
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
<span class="comensal-local">${local}</span>
</header>
<main class="contenedor">
<h1 class="comensal-mesa">Tus pedidos · ${mesa}</h1>
<p class="ayuda">${
    hayEnMarcha
      ? "Esta pantalla se actualiza sola mientras quede algo en marcha."
      : "Ya no queda nada en marcha: esta pantalla no necesita actualizarse."
  }</p>
${avisoHermanas}
${lista}
<p><a class="boton boton-secundario" href="/t/${codigo}">Volver a la carta</a></p>
</main>`
  return paginaComensal("Tus pedidos", contenido, hayEnMarcha ? REFRESCO_PEDIDOS_EN_MARCHA : null)
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
  return paginaComensal("Mesa no encontrada", contenido, null)
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
  return paginaComensal("Mesa cerrada", contenido, null)
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
  return paginaComensal("Local sin abrir", contenido, null)
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
  return paginaComensal("Código no encontrado", contenido, null)
}
