/**
 * Ninguna pantalla escribe un color a mano (ADR-0035).
 *
 * El test recorre el codigo de las pantallas del panel y del comensal y busca hex, `rgb(` y
 * `hsl(`. Un color ahi dentro no cambia con el modelo del local ni con el modo oscuro: es una
 * decision escondida. El unico lugar con colores es la capa de tokens.
 *
 * La prueba se demuestra capaz de fallar: el mismo detector, sobre un texto con un color
 * literal, lo encuentra. Si esa comprobacion dejara de encontrarlo, la guardia seria decorativa.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { CLASES_COMPONENTE, COMPONENTES_CSS } from "../src/componentes.ts"
import { detectarColoresLiterales } from "../src/guardia.ts"

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url))

function ficherosTs(directorio: string): readonly string[] {
  const encontrados: string[] = []
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada)
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...ficherosTs(ruta))
    } else if (entrada.endsWith(".ts")) {
      encontrados.push(ruta)
    }
  }
  return encontrados
}

const SUPERFICIES = ["panel", "comensal"].map((carpeta) =>
  join(RAIZ, "workers", "api", "src", carpeta),
)

describe("Paleta: ningun color a mano en las pantallas", () => {
  for (const directorio of SUPERFICIES) {
    it(`no debe haber colores literales en ${directorio.split(/[\\/]/).slice(-2).join("/")}`, () => {
      const infracciones: string[] = []
      for (const fichero of ficherosTs(directorio)) {
        const encontrados = detectarColoresLiterales(readFileSync(fichero, "utf8"))
        if (encontrados.length > 0) {
          infracciones.push(`${fichero}: ${encontrados.join(", ")}`)
        }
      }
      expect(infracciones, `Colores escritos a mano:\n${infracciones.join("\n")}`).toEqual([])
    })
  }

  it("no debe haber colores literales en los componentes del sistema", () => {
    expect(detectarColoresLiterales(COMPONENTES_CSS)).toEqual([])
  })

  it("debe declarar los componentes basicos que el sistema garantiza", () => {
    for (const clase of Object.values(CLASES_COMPONENTE)) {
      expect(COMPONENTES_CSS).toContain(`.${clase}`)
    }
  })

  it("debe saber fallar cuando una pantalla trae un color a mano", () => {
    const muestra = '<span class="etiqueta" style-fake="#ff00aa">rgb(1,2,3)</span>'
    expect(detectarColoresLiterales(muestra)).toEqual(["#ff00aa", "rgb("])
  })
})
