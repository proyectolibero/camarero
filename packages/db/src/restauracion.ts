/**
 * Comparacion de metricas del ensayo de restauracion.
 *
 * Vive aparte del script para poder probarse sin base de datos: lo unico que hace es
 * contrastar dos fotografias (la de origen y la restaurada) y decir, campo a campo, si
 * coinciden. El ensayo de verdad —conectar y restaurar— lo orquesta el flujo de copias.
 */

export type MetricasDeRestauracion = {
  readonly tablasPublicas: number
  readonly orgs: number
  readonly locations: number
  readonly staff: number
  readonly authUsers: number
}

export type ResultadoDeComparacion = {
  readonly ok: boolean
  readonly lineas: readonly string[]
  readonly discrepancias: number
}

/** Orden fijo: el informe se lee igual en cada ejecucion. */
const CAMPOS: readonly (keyof MetricasDeRestauracion)[] = [
  "tablasPublicas",
  "orgs",
  "locations",
  "staff",
  "authUsers",
]

export function compararMetricas(
  origen: MetricasDeRestauracion,
  restaurada: MetricasDeRestauracion,
): ResultadoDeComparacion {
  const lineas: string[] = []
  let discrepancias = 0
  for (const campo of CAMPOS) {
    const coincide = origen[campo] === restaurada[campo]
    if (!coincide) {
      discrepancias++
    }
    lineas.push(
      `${campo}: origen=${origen[campo]} restaurado=${restaurada[campo]} ${coincide ? "OK" : "DIFERENTE"}`,
    )
  }
  return { ok: discrepancias === 0, lineas, discrepancias }
}
