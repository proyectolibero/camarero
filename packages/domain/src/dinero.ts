/**
 * Calculo de importes en CLP enteros (CONTRACT-dinero, ADR-0006).
 *
 * Los importes SIEMPRE son enteros de pesos chilenos: nunca coma flotante, nunca
 * `.toFixed()` para calcular. La funcion que suma lineas vive aqui, en el dominio, y es la
 * unica. El precio de cada linea no viene del cliente: lo fija la base desde la carta.
 */

export type LineaDeImporte = {
  readonly precioClp: number
  readonly cantidad: number
}

/** Subtotal de la cesta: suma de precio por cantidad, en enteros. Sin descuento ni propina. */
export function subtotalDeLineas(lineas: readonly LineaDeImporte[]): number {
  return lineas.reduce((suma, linea) => suma + linea.precioClp * linea.cantidad, 0)
}
