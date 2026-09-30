/**
 * Geometria del mapa de mesas: cuadricula, primer hueco libre y desplazamiento.
 *
 * Todo aqui es puro y no toca la base ni el HTML: por eso se puede probar sin ningun doble.
 * La regla de oro (D-046): la cuadricula tiene un minimo de 6x4, crece hacia abajo y a la
 * derecha para acomodar la mesa mas lejana, y nunca produce un indice negativo. El borde
 * superior y el izquierdo son los unicos limites; el inferior y el derecho crecen.
 */

export const DIRECCIONES = ["arriba", "abajo", "izquierda", "derecha"] as const
export type Direccion = (typeof DIRECCIONES)[number]

export const COLUMNAS_MINIMAS = 6
export const FILAS_MINIMAS = 4

/** Posicion de una mesa en la cuadricula de su zona. */
export type Posicion = { readonly fila: number; readonly columna: number }

/** Lo unico que hace falta saber de una mesa para colocarla: donde esta (o si no esta). */
export type Celda = {
  readonly posFila: number | null
  readonly posColumna: number | null
}

export type Dimensiones = { readonly filas: number; readonly columnas: number }

export function esDireccion(valor: string): valor is Direccion {
  return (DIRECCIONES as readonly string[]).includes(valor)
}

/** Dimensiones de la cuadricula: minimo 6x4, creciendo para incluir la mesa mas lejana. */
export function dimensionesDeMapa(celdas: readonly Celda[]): Dimensiones {
  let filas = FILAS_MINIMAS
  let columnas = COLUMNAS_MINIMAS
  for (const celda of celdas) {
    if (celda.posFila !== null) {
      filas = Math.max(filas, celda.posFila + 1)
    }
    if (celda.posColumna !== null) {
      columnas = Math.max(columnas, celda.posColumna + 1)
    }
  }
  return { filas, columnas }
}

/**
 * Primer hueco libre en orden de fila y luego columna. Con N mesas ocupadas y N+1 celdas
 * exploradas, por el principio del palomar siempre hay una libre, asi que el bucle termina.
 */
export function primerHuecoLibre(celdas: readonly Celda[], columnas: number): Posicion {
  const ocupadas = new Set(
    celdas
      .filter((celda) => celda.posFila !== null && celda.posColumna !== null)
      .map((celda) => `${celda.posFila},${celda.posColumna}`),
  )
  const candidatas: Posicion[] = []
  for (let indice = 0; indice <= celdas.length; indice += 1) {
    const fila = Math.floor(indice / columnas)
    const columna = indice % columnas
    candidatas.push({ fila, columna })
  }
  const libre = candidatas.find((celda) => !ocupadas.has(`${celda.fila},${celda.columna}`))
  if (libre === undefined) {
    throw new Error("No hay hueco libre en la cuadricula: la cuenta de mesas no cuadra")
  }
  return libre
}

/**
 * Desplaza una posicion una celda. Devuelve null si sale por arriba o por la izquierda: la
 * cuadricula crece hacia abajo y a la derecha, pero no tiene indices negativos.
 */
export function desplazar(posicion: Posicion, direccion: Direccion): Posicion | null {
  if (direccion === "arriba") {
    return posicion.fila === 0 ? null : { fila: posicion.fila - 1, columna: posicion.columna }
  }
  if (direccion === "abajo") {
    return { fila: posicion.fila + 1, columna: posicion.columna }
  }
  if (direccion === "izquierda") {
    return posicion.columna === 0 ? null : { fila: posicion.fila, columna: posicion.columna - 1 }
  }
  return { fila: posicion.fila, columna: posicion.columna + 1 }
}
