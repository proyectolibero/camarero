/**
 * Generacion del QR de mesa en el servidor, como SVG (ADR-0028).
 *
 * El panel no tiene JavaScript (CSP sin `unsafe-inline`), asi que el QR no lo puede dibujar
 * el navegador. Una libreria pequena y sin dependencias (`qrcode-generator`, MIT) calcula la
 * matriz de modulos; el dibujo del SVG es nuestro. El contenido sale de una variable de
 * configuracion (el dominio publico), nunca escrito aqui a mano.
 *
 * El SVG se marca como seguro en la vista con `htmlCrudo` porque es nuestro; aun asi la
 * etiqueta visible se escapa. Los modulos oscuros se agrupan por fila para que la hoja no
 * pese de mas cuando se imprimen todas las mesas.
 */
import qrcode from "qrcode-generator"
import { escapar } from "./html.ts"

export type MatrizQr = readonly (readonly boolean[])[]

/** Nivel de correccion medio: tolera manchas leves del papel sin crecer demasiado. */
const NIVEL_CORRECCION = "M"

/** Zona de silencio obligatoria: sin ella el lector no engancha el patron. */
export const MARGEN_MODULOS = 4

export function generarMatriz(contenido: string): MatrizQr {
  const codigo = qrcode(0, NIVEL_CORRECCION)
  codigo.addData(contenido, "Byte")
  codigo.make()
  const lado = codigo.getModuleCount()
  const matriz: boolean[][] = []
  for (let fila = 0; fila < lado; fila += 1) {
    const linea: boolean[] = []
    for (let columna = 0; columna < lado; columna += 1) {
      linea.push(codigo.isDark(fila, columna))
    }
    matriz.push(linea)
  }
  return matriz
}

/** Une los modulos oscuros consecutivos de cada fila en un solo rectangulo. */
function rectangulosOscuros(matriz: MatrizQr, margen: number): string {
  const rectangulos: string[] = []
  matriz.forEach((fila, indiceFila) => {
    let columna = 0
    while (columna < fila.length) {
      if (fila[columna] !== true) {
        columna += 1
        continue
      }
      let ancho = 1
      while (columna + ancho < fila.length && fila[columna + ancho] === true) {
        ancho += 1
      }
      rectangulos.push(
        `<rect x="${columna + margen}" y="${indiceFila + margen}" width="${ancho}" height="1" fill="#000000"/>`,
      )
      columna += ancho
    }
  })
  return rectangulos.join("")
}

export function matrizASvg(matriz: MatrizQr, etiqueta: string): string {
  const lado = matriz.length
  const total = lado + MARGEN_MODULOS * 2
  const etiquetaSegura = escapar(etiqueta)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges" role="img" aria-label="${etiquetaSegura}">`,
    `<title>${etiquetaSegura}</title>`,
    `<rect width="${total}" height="${total}" fill="#ffffff"/>`,
    rectangulosOscuros(matriz, MARGEN_MODULOS),
    `</svg>`,
  ].join("")
}

export function generarQrSvg(contenido: string, etiqueta: string = contenido): string {
  return matrizASvg(generarMatriz(contenido), etiqueta)
}
