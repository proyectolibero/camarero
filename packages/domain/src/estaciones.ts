/**
 * Puestos de preparacion del local (ADR-0033, ADR-0034, LL-025).
 *
 * Los puestos son DATOS del local: el dueno los nombra (Parrilla, Plancha, Postre, Barra) y
 * cada uno decide si nace aceptado (`auto_accept`) o si espera aprobacion humana. Este modulo
 * ya no enumera valores fijos: solo da el vocabulario comun entre el borde, el panel y las
 * pantallas. La regla que resuelve el puesto real de un plato (plato -> categoria -> defecto
 * del local) tiene UNA sola fuente de verdad en TypeScript, que es la consulta del borde; la
 * base la aplica con `camarero_estacion_de_plato` y su disparador (H4, antes estaba triplicada).
 */

/** La pantalla que junta todos los puestos de un local, para un local de una sola pantalla. */
export const PANTALLA_TODOS = "todo"

/**
 * Una pantalla de trabajo es el identificador de un puesto del local o la pantalla `todo`.
 * El tipo es `string` porque el identificador es un UUID que solo conoce la base; la pantalla
 * nunca lo inventa, lo lee de los puestos del local.
 */
export type PuestoDePantalla = string

/** Reconoce la pantalla que muestra todo junto. */
export function esPantallaTodos(valor: string): boolean {
  return valor === PANTALLA_TODOS
}

/** Un puesto del local tal como lo nombra el dueno. */
export type PuestoDelLocal = {
  readonly id: string
  readonly nombre: string
  readonly orden: number
  readonly activo: boolean
  readonly autoAcepta: boolean
  readonly porDefecto: boolean
}

/** Un plato con el puesto que la base le resuelve (el suyo, el de su categoria o el del local). */
export type PlatoConPuesto = {
  readonly puestoId: string | null
  readonly autoAcepta: boolean
}

/**
 * Etiqueta de un puesto en una lista, para no inventar un nombre si el puesto ya no esta:
 * cae al identificador crudo, que es la verdad que la comanda congelo.
 */
export function nombreDePuesto(
  puestos: readonly PuestoDelLocal[],
  puestoId: string | null,
): string | null {
  if (puestoId === null) {
    return null
  }
  return puestos.find((puesto) => puesto.id === puestoId)?.nombre ?? null
}
