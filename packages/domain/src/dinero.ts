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

/** Una linea con su total ya calculado por la base (incluye los modificadores aplicados). */
export type LineaConTotal = {
  readonly totalClp: number
}

/**
 * Suma totales de linea ya calculados. Es la MISMA funcion del dominio para el total que ve el
 * comensal: el comensal no vuelve a multiplicar ni a redondear, solo confia en el total que la
 * base persistio en cada linea. Tenerla aqui evita un segundo calculo que, con descuentos o
 * propina (F2), podria separarse de la cuenta real (CONTRACT-dinero).
 */
export function totalDeLineas(lineas: readonly LineaConTotal[]): number {
  return lineas.reduce((suma, linea) => suma + linea.totalClp, 0)
}
