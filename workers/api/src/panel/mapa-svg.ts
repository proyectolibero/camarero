/**
 * El mapa de mesas como SVG dibujado en el servidor (ADR-0029).
 *
 * No hay JavaScript en el panel, asi que el mapa no lo dibuja el navegador: sale ya hecho del
 * Worker. Cada zona es un SVG con una celda por posicion y una ficha por mesa. Una mesa
 * desactivada se raya con un patron y se distingue de un vistazo; el SVG lleva `title` y
 * `desc` para no ser una imagen muda. El color sale de la hoja de estilos, no de atributos
 * sueltos, para que el modo oscuro siga funcionando.
 */
import type { HtmlSeguro } from "../ui/html.ts"
import { html, htmlCrudo } from "../ui/html.ts"
import type { Mesa } from "./datos.ts"
import { dimensionesDeMapa } from "./mapa.ts"

const ANCHO_CELDA = 64
const ALTO_CELDA = 52
const SEPARACION = 4
const CARACTERES_POR_LINEA = 8
const INTERLINEADO = 14

/** Parte una etiqueta en lineas cortas. Si no cabe en `maxLineas`, recorta con puntos suspensivos. */
export function envolverEtiqueta(
  texto: string,
  maxPorLinea: number,
  maxLineas: number,
): readonly string[] {
  const palabras = texto
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra !== "")
  const lineas: string[] = []
  let actual = ""
  for (const palabra of palabras) {
    if (actual === "") {
      actual = palabra
    } else if (actual.length + 1 + palabra.length <= maxPorLinea) {
      actual = `${actual} ${palabra}`
    } else {
      lineas.push(actual)
      actual = palabra
    }
  }
  if (actual !== "") {
    lineas.push(actual)
  }
  if (lineas.length === 0) {
    return [""]
  }
  if (lineas.length <= maxLineas) {
    return lineas
  }
  const recortadas = lineas.slice(0, maxLineas)
  recortadas[maxLineas - 1] = `${recortadas[maxLineas - 1]}…`
  return recortadas
}

function patronRayado(sufijo: string): HtmlSeguro {
  return html`<pattern id="rayado-${sufijo}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<rect class="mapa-inactiva-fondo" width="6" height="6"></rect>
<line class="mapa-raya" x1="0" y1="0" x2="0" y2="6"></line>
</pattern>`
}

function celdasDeFondo(filas: number, columnas: number): readonly HtmlSeguro[] {
  const celdas: HtmlSeguro[] = []
  for (let fila = 0; fila < filas; fila += 1) {
    for (let columna = 0; columna < columnas; columna += 1) {
      celdas.push(
        html`<rect class="mapa-celda" x="${columna * ANCHO_CELDA + 2}" y="${fila * ALTO_CELDA + 2}" width="${ANCHO_CELDA - 4}" height="${ALTO_CELDA - 4}" rx="6"></rect>`,
      )
    }
  }
  return celdas
}

function lineasDeEtiqueta(
  etiqueta: string,
  centroX: number,
  centroY: number,
): readonly HtmlSeguro[] {
  const lineas = envolverEtiqueta(etiqueta, CARACTERES_POR_LINEA, 2)
  const desplazamiento = ((lineas.length - 1) / 2) * INTERLINEADO
  return lineas.map(
    (linea, indice) =>
      html`<tspan x="${centroX}" y="${centroY - desplazamiento + indice * INTERLINEADO}">${linea}</tspan>`,
  )
}

/** Como se elige una mesa desde el mapa, si es que se puede elegir. */
export type OpcionesDeMapa = {
  readonly urlDeMesa?: (mesa: Mesa) => string
  readonly mesaElegidaId?: string | null
}

/**
 * Dibuja una ficha. Si hay `urlDeMesa`, la envuelve en un enlace `<a>`: elegir no es mutar,
 * asi que puede ser un GET y se ve en la direccion. La mesa elegida lleva un contorno grueso
 * para que el mapa diga por si solo cual se va a mover, sin coordenadas en jerga.
 */
function fichaDeMesa(mesa: Mesa, sufijo: string, opciones: OpcionesDeMapa): HtmlSeguro {
  if (mesa.posFila === null || mesa.posColumna === null) {
    return html``
  }
  const x = mesa.posColumna * ANCHO_CELDA + SEPARACION
  const y = mesa.posFila * ALTO_CELDA + SEPARACION
  const ancho = ANCHO_CELDA - SEPARACION * 2
  const alto = ALTO_CELDA - SEPARACION * 2
  const clase = mesa.activa ? "mapa-mesa mapa-mesa-activa" : "mapa-mesa mapa-mesa-inactiva"
  const claseTexto = mesa.activa ? "mapa-etiqueta" : "mapa-etiqueta mapa-etiqueta-inactiva"
  const relleno = mesa.activa ? html`` : html` fill="url(#rayado-${sufijo})"`
  const estado = mesa.activa ? "activa" : "desactivada"
  const elegida = opciones.mesaElegidaId === mesa.id
  const claseFicha = elegida ? "mapa-ficha mapa-ficha-elegida" : "mapa-ficha"
  const lineas = lineasDeEtiqueta(mesa.etiqueta, x + ancho / 2, y + alto / 2)
  const ficha = html`<g class="${claseFicha}"><title>${mesa.etiqueta} (${estado})</title><rect class="${clase}" x="${x}" y="${y}" width="${ancho}" height="${alto}" rx="6"${relleno}></rect><text class="${claseTexto}" text-anchor="middle">${lineas}</text></g>`
  const url = opciones.urlDeMesa?.(mesa)
  if (url === undefined) {
    return ficha
  }
  const actual = elegida ? htmlCrudo(' aria-current="true"') : html``
  return html`<a class="mapa-enlace" href="${url}"${actual}>${ficha}</a>`
}

/** Dibuja el mapa de una zona. `indice` solo hace unicos los identificadores del SVG en la pagina. */
export function svgDeZona(
  nombreZona: string,
  mesas: readonly Mesa[],
  indice: number,
  opciones: OpcionesDeMapa = {},
): HtmlSeguro {
  const { filas, columnas } = dimensionesDeMapa(mesas)
  const ancho = columnas * ANCHO_CELDA
  const alto = filas * ALTO_CELDA
  const sufijo = `z${indice}`
  const idTitulo = `mapa-titulo-${sufijo}`
  const idDescripcion = `mapa-desc-${sufijo}`
  const cuantas = `${mesas.length} ${mesas.length === 1 ? "mesa" : "mesas"}`
  const fichas = mesas.map((mesa) => fichaDeMesa(mesa, sufijo, opciones))
  return html`<svg class="mapa-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-labelledby="${idTitulo} ${idDescripcion}" xmlns="http://www.w3.org/2000/svg">
<title id="${idTitulo}">Mapa de ${nombreZona}</title>
<desc id="${idDescripcion}">Mapa de la zona ${nombreZona} con ${cuantas}.</desc>
<defs>${patronRayado(sufijo)}</defs>
${celdasDeFondo(filas, columnas)}
${fichas}
</svg>`
}
