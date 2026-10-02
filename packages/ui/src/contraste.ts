/**
 * Contraste segun WCAG 2.1.
 *
 * El contraste es la unica parte del diseno que se puede medir con un numero en lugar de
 * mirarla. Los modelos se comprueban con esta funcion en las pruebas, de modo que bajar un
 * color por debajo del minimo rompe la suite y no se descubre en el movil de un comensal.
 */

const MINIMO_TEXTO = 4.5
const MINIMO_GRAFICO = 3

/** Un color hexadecimal legible: `#rrggbb`. Cualquier otra cosa es un error de programacion. */
export const PATRON_HEX = /^#[0-9a-fA-F]{6}$/

export function esHex(valor: string): boolean {
  return PATRON_HEX.test(valor)
}

function canal(hex: string, inicio: number): number {
  const par = hex.slice(inicio, inicio + 2)
  if (par.length !== 2) {
    throw new Error(`Color hexadecimal ilegible: ${hex}`)
  }
  return Number.parseInt(par, 16)
}

function aLineal(valor: number): number {
  const proporcion = valor / 255
  return proporcion <= 0.03928 ? proporcion / 12.92 : ((proporcion + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa segun WCAG 2.1. */
export function luminancia(hex: string): number {
  if (!esHex(hex)) {
    throw new Error(`Color hexadecimal ilegible: ${hex}`)
  }
  return (
    0.2126 * aLineal(canal(hex, 1)) +
    0.7152 * aLineal(canal(hex, 3)) +
    0.0722 * aLineal(canal(hex, 5))
  )
}

/** Razon de contraste entre dos colores opacos. Siempre mayor o igual que 1. */
export function contraste(unColor: string, otroColor: string): number {
  const uno = luminancia(unColor)
  const otro = luminancia(otroColor)
  return (Math.max(uno, otro) + 0.05) / (Math.min(uno, otro) + 0.05)
}

/**
 * Tinta legible sobre un color de fondo. Devuelve el blanco o el casi-negro que MAS contrasta,
 * de modo que un acento elegido por el local nunca deje un texto ilegible encima.
 */
export function tintaSobre(fondo: string): "#ffffff" | "#111827" {
  return contraste("#ffffff", fondo) >= contraste("#111827", fondo) ? "#ffffff" : "#111827"
}

export { MINIMO_GRAFICO, MINIMO_TEXTO }
