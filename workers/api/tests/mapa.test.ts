/**
 * Geometria del mapa y su dibujo en el servidor.
 *
 * Son funciones puras: no hay base, ni red, ni navegador. Se prueban los bordes que la
 * aceptacion nombra (la cuadricula crece, el primer hueco libre, el limite superior/izquierdo)
 * y que el SVG no sea una imagen muda.
 */
import { describe, expect, it } from "vitest"
import type { Mesa } from "../src/panel/datos.ts"
import {
  COLUMNAS_MINIMAS,
  desplazar,
  dimensionesDeMapa,
  esDireccion,
  FILAS_MINIMAS,
  primerHuecoLibre,
} from "../src/panel/mapa.ts"
import { envolverEtiqueta, svgDeZona } from "../src/panel/mapa-svg.ts"

function mesa(parcial: Partial<Mesa>): Mesa {
  return {
    id: "m",
    codigo: "ABCDEFGH",
    etiqueta: "Mesa",
    capacidad: 2,
    kind: "mesa",
    activa: true,
    zonaId: "z1",
    zonaNombre: "Sala",
    posFila: 0,
    posColumna: 0,
    ...parcial,
  }
}

describe("Mapa: dimensiones", () => {
  it("debe partir del minimo 6x4 sin mesas", () => {
    expect(dimensionesDeMapa([])).toEqual({ filas: FILAS_MINIMAS, columnas: COLUMNAS_MINIMAS })
  })

  it("debe crecer para incluir la mesa mas lejana", () => {
    const mesas = [mesa({ posFila: 6, posColumna: 9 })]
    expect(dimensionesDeMapa(mesas)).toEqual({ filas: 7, columnas: 10 })
  })

  it("no debe encogerse por debajo del minimo con mesas cerca", () => {
    expect(dimensionesDeMapa([mesa({ posFila: 0, posColumna: 0 })])).toEqual({
      filas: FILAS_MINIMAS,
      columnas: COLUMNAS_MINIMAS,
    })
  })
})

describe("Mapa: primer hueco libre", () => {
  it("debe colocar la primera mesa en la esquina", () => {
    expect(primerHuecoLibre([], COLUMNAS_MINIMAS)).toEqual({ fila: 0, columna: 0 })
  })

  it("debe saltar las celdas ocupadas", () => {
    const mesas = [mesa({ posFila: 0, posColumna: 0 }), mesa({ posFila: 0, posColumna: 1 })]
    expect(primerHuecoLibre(mesas, COLUMNAS_MINIMAS)).toEqual({ fila: 0, columna: 2 })
  })

  it("debe pasar a la fila siguiente al llenar la primera", () => {
    const mesas = Array.from({ length: COLUMNAS_MINIMAS }, (_valor, columna) =>
      mesa({ posFila: 0, posColumna: columna }),
    )
    expect(primerHuecoLibre(mesas, COLUMNAS_MINIMAS)).toEqual({ fila: 1, columna: 0 })
  })

  it("no debe contar una posicion nula como celda ocupada", () => {
    const mesas = [mesa({ posFila: null, posColumna: null })]
    expect(primerHuecoLibre(mesas, COLUMNAS_MINIMAS)).toEqual({ fila: 0, columna: 0 })
  })
})

describe("Mapa: desplazamiento", () => {
  it("debe moverse en las cuatro direcciones", () => {
    const origen = { fila: 2, columna: 2 }
    expect(desplazar(origen, "arriba")).toEqual({ fila: 1, columna: 2 })
    expect(desplazar(origen, "abajo")).toEqual({ fila: 3, columna: 2 })
    expect(desplazar(origen, "izquierda")).toEqual({ fila: 2, columna: 1 })
    expect(desplazar(origen, "derecha")).toEqual({ fila: 2, columna: 3 })
  })

  it("no debe salir por arriba ni por la izquierda", () => {
    expect(desplazar({ fila: 0, columna: 0 }, "arriba")).toBeNull()
    expect(desplazar({ fila: 0, columna: 0 }, "izquierda")).toBeNull()
  })

  it("debe crecer hacia abajo y a la derecha", () => {
    expect(desplazar({ fila: 5, columna: 5 }, "abajo")).toEqual({ fila: 6, columna: 5 })
    expect(desplazar({ fila: 5, columna: 5 }, "derecha")).toEqual({ fila: 5, columna: 6 })
  })

  it("debe reconocer solo las direcciones validas", () => {
    expect(esDireccion("arriba")).toBe(true)
    expect(esDireccion("diagonal")).toBe(false)
    expect(esDireccion("")).toBe(false)
  })
})

describe("Mapa: etiquetas", () => {
  it("debe dejar en una linea una etiqueta corta", () => {
    expect(envolverEtiqueta("Barra 1", 8, 2)).toEqual(["Barra 1"])
  })

  it("debe partir en dos lineas y recortar con puntos suspensivos", () => {
    const lineas = envolverEtiqueta("Terraza junto a la ventana", 8, 2)
    expect(lineas).toHaveLength(2)
    expect(lineas[1]?.endsWith("…")).toBe(true)
  })
})

describe("Mapa: SVG en el servidor", () => {
  it("debe dibujar un SVG con su title y su desc, sin script", () => {
    const svg = svgDeZona("Terraza", [mesa({ etiqueta: "Terraza 4" })], 0)
    const texto = svg.valor
    expect(texto).toContain("<svg")
    expect(texto).toContain('role="img"')
    expect(texto).toContain("<title")
    expect(texto).toContain("<desc")
    expect(texto).toContain("Terraza 4")
    expect(texto).not.toContain("<script")
  })

  it("debe distinguir una mesa desactivada con su patron de rayas", () => {
    const svg = svgDeZona("Barra", [mesa({ activa: false })], 0)
    expect(svg.valor).toContain("mapa-mesa-inactiva")
    expect(svg.valor).toContain("rayado-z0")
    expect(svg.valor).toContain("desactivada")
  })
})
