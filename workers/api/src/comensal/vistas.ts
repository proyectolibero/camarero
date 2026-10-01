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
import type { CartaDelComensal, CategoriaDeCarta, PlatoDeCarta } from "./datos.ts"

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
        : html`<p class="ayuda">Quedan unos ${carta.restanteSegundos} segundos.</p>`
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

function fichaDePlato(plato: PlatoDeCarta): HtmlSeguro {
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
</li>`
}

function seccionDeCategoria(categoria: CategoriaDeCarta): HtmlSeguro {
  return html`<section class="comensal-categoria">
<h2>${categoria.nombre}</h2>
<ul class="comensal-platos">${categoria.platos.map(fichaDePlato)}</ul>
</section>`
}

export function vistaCartaComensal(carta: CartaDelComensal, codigo: string): HtmlSeguro {
  const cartaVacia =
    carta.categorias.length === 0
      ? html`<p>Todavía no hay nada publicado en la carta de este local.</p>`
      : html``
  const contenido = html`<header class="comensal-cabecera">
<span class="marca">Camarero</span>
<span class="comensal-local">${carta.local}</span>
</header>
<main class="contenedor">
<h1 class="comensal-mesa">${carta.mesa}</h1>
${bloqueEmparejamiento(carta, codigo)}
<h2 class="comensal-carta-titulo">Carta</h2>
${cartaVacia}
${carta.categorias.map(seccionDeCategoria)}
</main>`
  return paginaComensal(carta.mesa, contenido, carta.estado === "esperando")
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
