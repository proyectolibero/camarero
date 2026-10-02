/**
 * Guardia contra colores escritos a mano.
 *
 * Un color literal en una pantalla es una decision de diseno escondida: no cambia con el
 * modelo del local ni con el modo oscuro. Esta funcion los encuentra para que una prueba
 * pueda ponerse en rojo. El patron cubre hex de 3 a 8 cifras, `rgb(`/`rgba(` y `hsl(`/`hsla(`.
 */

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g

/** Devuelve las coincidencias de color literal encontradas, en orden. Vacio es lo correcto. */
export function detectarColoresLiterales(texto: string): readonly string[] {
  return texto.match(COLOR_LITERAL) ?? []
}
