/**
 * Puestos de preparacion y pantallas del KDS (ADR-0033, LL-025).
 *
 * Cada plato de la carta trae su estacion (`menu_items.prep_station`, con los valores del
 * `check` de 0004: frio, caliente, bar, postre, bebidas). Una comanda nace con SU destino,
 * que es una copia de esa estacion; si el plato no tiene estacion, va al destino generico
 * `cocina`, que exige aprobacion humana como los demas puestos de cocina.
 *
 * Las pantallas agrupan destinos: `cocina` ve los de cocina, `barra` los de barra y `todo`
 * los ve todos. Los destinos `bar` y `bebidas` no necesitan que nadie los apruebe: nacen
 * aceptados, y su proteccion es que el local puede anular (ADR-0033).
 */

/** Destinos genericos de un plato sin estacion. `cocina` NO es un valor de menu_items. */
export const DESTINO_SIN_ESTACION = "cocina"

/** Destinos que se preparan en la cocina y esperan aprobacion humana. */
export const DESTINOS_DE_COCINA = ["frio", "caliente", "postre", DESTINO_SIN_ESTACION] as const

/** Destinos que se preparan en la barra y nacen aceptados: una bebida es automatica. */
export const DESTINOS_DE_BARRA = ["bar", "bebidas"] as const

/** Las tres pantallas de puesto que puede abrir un dispositivo. */
export const PUESTOS_DE_PANTALLA = ["cocina", "barra", "todo"] as const

export type PuestoDePantalla = (typeof PUESTOS_DE_PANTALLA)[number]

/** Reconoce la pantalla de un puesto a partir de un texto de la ruta. */
export function esPuestoDePantalla(valor: string): valor is PuestoDePantalla {
  return (PUESTOS_DE_PANTALLA as readonly string[]).includes(valor)
}

/**
 * Destino de una comanda a partir de la estacion del plato. Un plato sin estacion va al
 * destino generico de cocina: un plato sin clasificar necesita que alguien lo acepte.
 */
export function destinoDeEstacion(estacion: string | null): string {
  return estacion === null || estacion === "" ? DESTINO_SIN_ESTACION : estacion
}

/** Verdadero para los destinos que no necesitan aprobacion: la barra y las bebidas. */
export function esEstacionAutomatica(destino: string | null): boolean {
  return destino !== null && (DESTINOS_DE_BARRA as readonly string[]).includes(destino)
}

/**
 * Destinos que ve una pantalla. `todo` no filtra: devuelve null para decir "todos". La lista
 * se lee de las constantes de arriba, que son los valores reales del `check` de la carta.
 */
export function destinosDelPuesto(puesto: PuestoDePantalla): readonly string[] | null {
  if (puesto === "cocina") {
    return DESTINOS_DE_COCINA
  }
  if (puesto === "barra") {
    return DESTINOS_DE_BARRA
  }
  return null
}

const ETIQUETAS: Readonly<Record<string, string>> = {
  frio: "Frío",
  caliente: "Caliente",
  bar: "Barra",
  postre: "Postre",
  bebidas: "Bebidas",
  [DESTINO_SIN_ESTACION]: "Cocina",
}

/** Nombre legible de un destino para las pantallas. Nunca se inventa: cae al valor crudo. */
export function etiquetaDeEstacion(destino: string): string {
  return ETIQUETAS[destino] ?? destino
}
