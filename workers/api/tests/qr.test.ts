/**
 * QR de mesa: generacion y, sobre todo, comprobacion de que ESCANEA.
 *
 * No basta con que se genere algo. Se rasteriza el SVG producido (leyendo sus rectangulos),
 * se convierte a pixeles y se decodifica con `jsqr`, un decodificador independiente y solo
 * de pruebas. El texto leido tiene que ser EXACTAMENTE el contenido de entrada. Ademas hay un
 * vector fijo (mismo contenido -> misma matriz) para detectar cambios silenciosos.
 */
import jsQR from "jsqr"
import { describe, expect, it } from "vitest"
import { generarMatriz, generarQrSvg, MARGEN_MODULOS } from "../src/ui/qr.ts"

const CONTENIDO = "https://camarero.proyectolibero.org/t/CASA-1"

/** Matriz congelada de "CAMARERO" (version 1, correccion M). Detecta cambios silenciosos. */
const VECTOR_CAMARERO = [
  "#######.......#######",
  "#.....#...###.#.....#",
  "#.###.#..#.#..#.###.#",
  "#.###.#..###..#.###.#",
  "#.###.#..#.##.#.###.#",
  "#.....#.##....#.....#",
  "#######.#.#.#.#######",
  "..........#..........",
  "#..#.##.##.###.#.....",
  "#.#.#...#..#..##.#.#.",
  ".....###.#.#...#.##.#",
  ".##.##.#..#.######...",
  "..###.##.#.#..#.#.#.#",
  "........#....##.#.#..",
  "#######..####.###.##.",
  "#.....#.#.....#....#.",
  "#.###.#..##.####..##.",
  "#.###.#.#....###...##",
  "#.###.#..###.######.#",
  "#.....#...###..#.....",
  "#######.##...#..#.##.",
] as const

type Raster = { readonly datos: Uint8ClampedArray; readonly ancho: number; readonly alto: number }

/** Convierte el SVG generado a un mapa de bits RGBA, pintando sus rectangulos negros. */
function rasterizar(svg: string, escala: number): Raster {
  const lado = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1] ?? "0")
  const ancho = lado * escala
  const datos = new Uint8ClampedArray(ancho * lado * escala * 4)
  datos.fill(255)
  for (const rectangulo of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)"[^>]*#000000/g)) {
    pintarRectangulo(
      datos,
      ancho,
      escala,
      Number(rectangulo[1]),
      Number(rectangulo[2]),
      Number(rectangulo[3]),
    )
  }
  return { datos, ancho, alto: lado * escala }
}

function pintarRectangulo(
  datos: Uint8ClampedArray,
  ancho: number,
  escala: number,
  x: number,
  y: number,
  anchoModulos: number,
): void {
  for (let fila = 0; fila < escala; fila += 1) {
    for (let columna = 0; columna < anchoModulos * escala; columna += 1) {
      const indice = ((y * escala + fila) * ancho + x * escala + columna) * 4
      datos[indice] = 0
      datos[indice + 1] = 0
      datos[indice + 2] = 0
    }
  }
}

describe("Matriz del QR", () => {
  it("debe producir la matriz congelada para un contenido fijo", () => {
    const matriz = generarMatriz("CAMARERO")
    const comoTexto = matriz.map((fila) => fila.map((oscuro) => (oscuro ? "#" : ".")).join(""))
    expect(comoTexto).toEqual([...VECTOR_CAMARERO])
  })

  it("no debe producir la misma matriz para contenidos distintos", () => {
    expect(generarMatriz("CASA-1")).not.toEqual(generarMatriz("CASA-2"))
  })

  it("debe dibujar el SVG con margen y fondo blanco", () => {
    const svg = generarQrSvg(CONTENIDO)
    const lado = generarMatriz(CONTENIDO).length
    expect(svg).toContain(`viewBox="0 0 ${lado + MARGEN_MODULOS * 2} ${lado + MARGEN_MODULOS * 2}"`)
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain("<title>")
  })

  it("debe escapar la etiqueta visible del SVG", () => {
    const svg = generarQrSvg(CONTENIDO, "<b>mesa</b>")
    expect(svg).toContain("&lt;b&gt;mesa&lt;/b&gt;")
    expect(svg).not.toContain("<b>mesa</b>")
  })
})

describe("El QR escanea", () => {
  it("debe decodificar el SVG generado al mismo contenido", () => {
    const raster = rasterizar(generarQrSvg(CONTENIDO), 8)
    const leido = jsQR(raster.datos, raster.ancho, raster.alto, { inversionAttempts: "dontInvert" })
    expect(leido?.data).toBe(CONTENIDO)
  })

  it("debe decodificar una etiqueta de mesa distinta sin confundirla", () => {
    const contenido = "https://camarero.proyectolibero.org/t/QRSTUVWX"
    const raster = rasterizar(generarQrSvg(contenido), 8)
    const leido = jsQR(raster.datos, raster.ancho, raster.alto, { inversionAttempts: "dontInvert" })
    expect(leido?.data).toBe(contenido)
  })
})
