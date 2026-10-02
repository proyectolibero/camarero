/**
 * La cuenta de una mesa: descuento, propina y total (CONTRACT-dinero, D-039).
 *
 * Es la UNICA funcion de calculo de la cuenta. La usan el comensal (para verla) y el panel
 * (para registrar el cobro), de modo que no puede haber dos cifras distintas de la misma
 * mesa. Los importes son enteros de pesos chilenos: nunca coma flotante, nunca `.toFixed()`
 * para calcular. Todo redondeo es por piso, en favor del cliente.
 *
 * Definiciones de D-039, que manda sobre cualquier otro documento:
 *   subtotal  = suma de los platos y sus modificadores, SIN descontar
 *   descuento = reduccion aplicada, nunca mayor que el subtotal ni menor que cero
 *   importe   = subtotal - descuento (lo que paga el cliente antes de propina)
 *   propina   = piso(importe * tip_percent / 100), SIEMPRE sobre el importe descontado
 *   total     = importe + propina
 */
export const PORCENTAJES_DE_PROPINA = [0, 5, 10, 15, 20] as const

export type PorcentajeDePropina = (typeof PORCENTAJES_DE_PROPINA)[number]

export type DatosDeCuenta = {
  readonly subtotalClp: number
  /** Descuento ya calculado en CLP. Nunca procede del cliente. Por defecto, ninguno. */
  readonly descuentoClp?: number
  /** Porcentaje de propina elegido. Por defecto, sin propina. */
  readonly tipPercent?: number
}

export type CuentaCalculada = {
  readonly subtotalClp: number
  readonly descuentoClp: number
  readonly importeClp: number
  readonly propinaClp: number
  readonly totalClp: number
}

/** Entero no negativo; cualquier valor no finito se trata como cero en lugar de propagar NaN. */
function enteroNoNegativo(valor: number): number {
  return Number.isFinite(valor) ? Math.max(0, Math.trunc(valor)) : 0
}

/** Redondeo por piso: el sistema nunca cobra una fraccion de peso. */
function piso(numero: number): number {
  return Math.floor(numero)
}

/** Verdadero solo para los porcentajes de propina que admite el contrato. */
export function esPorcentajeDePropinaValido(valor: number): valor is PorcentajeDePropina {
  return (PORCENTAJES_DE_PROPINA as readonly number[]).includes(valor)
}

/** Descuento porcentual redondeado a entero por piso y nunca mayor que el subtotal. */
export function descuentoPorcentual(subtotalClp: number, porcentaje: number): number {
  const subtotal = enteroNoNegativo(subtotalClp)
  if (!Number.isFinite(porcentaje) || porcentaje <= 0) {
    return 0
  }
  return Math.min(piso((subtotal * porcentaje) / 100), subtotal)
}

/**
 * Calcula la cuenta completa con la formula unica del contrato. El descuento se limita al
 * subtotal para no dejar el importe por debajo de cero, y la propina se calcula sobre el
 * importe YA descontado, no sobre el subtotal.
 */
export function calcularCuenta(datos: DatosDeCuenta): CuentaCalculada {
  const subtotalClp = enteroNoNegativo(datos.subtotalClp)
  const descuentoClp = Math.min(enteroNoNegativo(datos.descuentoClp ?? 0), subtotalClp)
  const importeClp = subtotalClp - descuentoClp
  const tipPercent = enteroNoNegativo(datos.tipPercent ?? 0)
  const propinaClp = piso((importeClp * tipPercent) / 100)
  return {
    subtotalClp,
    descuentoClp,
    importeClp,
    propinaClp,
    totalClp: importeClp + propinaClp,
  }
}
