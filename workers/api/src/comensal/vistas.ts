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
import { type HtmlSeguro, html } from "../ui/html.ts"
import type { LineaResuelta } from "./cesta.ts"
import type {
  CartaDelComensal,
  CategoriaDeCarta,
  PedidoDelComensal,
  PlatoDeCarta,
} from "./datos.ts"

const FORMATO_CLP = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

function precio(clp: number): string {
  return `$ ${FORMATO_CLP.format(clp)}`
}

function paginaComensal(titulo: string, contenido: HtmlSeguro, refresco: boolean): HtmlSeguro {
  const metaRefresco = refresco ? html`<meta http-equiv="refresh" content="10">` : html``
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
  return paginaComensal(carta.mesa, contenido, carta.estado === "esperando")
}

// ---------------------------------------------------------------------------
// La cesta y el estado de los pedidos
// ---------------------------------------------------------------------------

const ETIQUETA_ESTADO_PEDIDO: Readonly<Record<string, string>> = {
  pendiente: "Enviada a cocina",
  aceptada: "Aceptada por cocina",
  preparando: "En preparación",
  lista: "Lista para servir",
  servida: "Servida",
  cerrada: "Cobrada",
  anulada: "Anulada",
}

function insigniaDeEstado(estado: string): HtmlSeguro {
  return html`<span class="pedido-estado pedido-estado-${estado}">${ETIQUETA_ESTADO_PEDIDO[estado] ?? estado}</span>`
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
  return html`<p class="aviso aviso-aviso cesta-aviso" role="alert">La comanda va <strong>directa a cocina</strong> en cuanto pulses «Enviar». Desde ahí <strong>no se deshace sola</strong>: si algo no está bien, avisa a quien te atiende.</p>`
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
    return paginaComensal("Tu cesta", contenido, false)
  }
  const enviar = opciones.puedeEnviar
    ? html`<form method="post" action="/t/${codigo}/cesta/enviar">
<input type="hidden" name="clave" value="${opciones.clave}">
<button class="boton boton-grande" type="submit">Enviar a cocina</button>
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
  return paginaComensal("Tu cesta", contenido, false)
}

/** Estado de los pedidos del comensal. Se refresca solo para ver como avanza la cocina. */
export function vistaPedidosComensal(
  local: string,
  mesa: string,
  codigo: string,
  pedidos: readonly PedidoDelComensal[],
): HtmlSeguro {
  const lista =
    pedidos.length === 0
      ? html`<section class="tarjeta"><p>Todavía no has enviado ninguna comanda.</p></section>`
      : html`${pedidos.map(
          (pedido) =>
            html`<section class="tarjeta pedido-comensal">
<h2>${insigniaDeEstado(pedido.estado)}</h2>
<ul class="pedido-lineas">${pedido.lineas.map(
              (linea) =>
                html`<li><span>${linea.cantidad}× ${linea.nombre}</span><span>${precio(linea.totalClp)}</span></li>`,
            )}</ul>
<p class="pedido-total"><span>Total</span> <strong>${precio(pedido.totalClp)}</strong></p>
</section>`,
        )}`
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
<span class="comensal-local">${local}</span>
</header>
<main class="contenedor">
<h1 class="comensal-mesa">Tus pedidos · ${mesa}</h1>
<p class="ayuda">Esta pantalla se actualiza sola para enseñarte cómo avanza la cocina.</p>
${lista}
<p><a class="boton boton-secundario" href="/t/${codigo}">Volver a la carta</a></p>
</main>`
  return paginaComensal("Tus pedidos", contenido, true)
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
  return paginaComensal("Mesa no encontrada", contenido, false)
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
  return paginaComensal("Local sin abrir", contenido, false)
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
  return paginaComensal("Código no encontrado", contenido, false)
}
