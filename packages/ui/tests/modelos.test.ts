/**
 * Los cinco modelos: el contraste se mide con numeros, no a ojo.
 *
 * Para cada modelo y cada modo se exige el minimo de WCAG (4,5:1 para texto normal). Si alguien
 * baja un color por debajo, esta prueba se pone roja. Incluye un caso que DEMUESTRA que sabe
 * fallar: un color que no cumple tiene que dar menos que el minimo con el mismo calculo.
 */
import { describe, expect, it } from "vitest"
import { contraste, MINIMO_TEXTO, tintaSobre } from "../src/contraste.ts"
import { MODELOS, NOMBRES_MODELO, temaCss } from "../src/temas.ts"

describe("Modelos: contraste medido", () => {
  for (const nombre of NOMBRES_MODELO) {
    const modelo = MODELOS[nombre]
    for (const [modo, crudos] of [
      ["claro", modelo.claro],
      ["oscuro", modelo.oscuro],
    ] as const) {
      it(`el modelo ${nombre} (${modo}) debe superar ${MINIMO_TEXTO}:1 texto sobre fondo`, () => {
        expect(contraste(crudos.tinta, crudos.fondo)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
        expect(contraste(crudos.tinta, crudos.superficie)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      })

      it(`el modelo ${nombre} (${modo}) debe superar ${MINIMO_TEXTO}:1 el texto sobre el acento`, () => {
        expect(contraste(crudos.sobreAcento, crudos.acento)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      })

      it(`el modelo ${nombre} (${modo}) debe superar ${MINIMO_TEXTO}:1 el texto suave sobre su fondo`, () => {
        expect(contraste(crudos.tintaSuave, crudos.superficie)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      })
    }
  }

  it("debe saber fallar cuando un texto no llega al minimo", () => {
    expect(contraste("#ffffff", "#e8f5ec")).toBeLessThan(MINIMO_TEXTO)
  })
})

describe("Modelos: la tinta sobre un acento elegido por el local", () => {
  it("debe escoger la tinta que mas contrasta", () => {
    expect(contraste(tintaSobre("#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(MINIMO_TEXTO)
    expect(contraste(tintaSobre("#111827"), "#111827")).toBeGreaterThanOrEqual(MINIMO_TEXTO)
  })

  it("debe recalcular la tinta al aplicar un acento propio", () => {
    // Un acento amarillo pide tinta oscura; el mismo modelo con acento marino pide clara.
    const amarillo = temaCss("sobrio", "#ffd400")
    expect(amarillo).toContain("--crudo-acento: #ffd400")
    expect(amarillo).toContain("--crudo-sobre-acento: #111827")
    const marino = temaCss("sobrio", "#0b2b5c")
    expect(marino).toContain("--crudo-sobre-acento: #ffffff")
  })

  it("debe ignorar un acento ilegible en lugar de inventarlo", () => {
    // Un valor que no es hex no cambia el acento del modelo.
    const css = temaCss("sobrio", "rojo")
    expect(css).toContain(`--crudo-acento: ${MODELOS.sobrio.claro.acento}`)
  })
})

describe("Modelos: dos capas de tokens", () => {
  it("los componentes deben leer alias, y los alias apuntar a la capa cruda", () => {
    const css = temaCss("verde")
    expect(css).toContain("--superficie: var(--crudo-superficie)")
    expect(css).toContain("--acento: var(--crudo-acento)")
    expect(css).toContain("--texto-suave: var(--crudo-tinta-suave)")
  })

  it("debe redefinir la capa cruda en el modo oscuro sin tocar los alias", () => {
    const css = temaCss("moderno")
    expect(css).toContain("@media (prefers-color-scheme: dark)")
    // El alias se escribe una sola vez; lo que cambia entre modos son los crudos.
    expect(css.match(/--superficie: var\(--crudo-superficie\)/g)?.length).toBe(1)
  })
})
