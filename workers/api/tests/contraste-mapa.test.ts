/**
 * Contraste del mapa de mesas (LL-020).
 *
 * La suite puede comprobar que el SVG TIENE una ficha por mesa, pero no que una persona la
 * VEA. Este test cierra la parte comprobable de esa brecha: lee los colores reales que sirve
 * `/panel/estilos.css` y exige las normas de accesibilidad WCAG (4,5:1 para texto normal y
 * 3:1 para elementos graficos) en los dos temas. No sustituye a mirar la previsualizacion:
 * la protege.
 */
import { describe, expect, it } from "vitest"
import { ESTILOS } from "../src/ui/estilos.ts"

const MINIMO_TEXTO = 4.5
const MINIMO_GRAFICO = 3

/**
 * Opacidad real que el CSS aplica al estado desactivado de la LISTA (`.mesa-inactiva`).
 * Si baja de 1, el color que llega al ojo no es el de la variable, y el contraste medido
 * tiene que componer la capa sobre el fondo, como hace el navegador.
 */
function leerOpacidadDeLista(css: string): number {
  const regla = /\.mesa-inactiva\s*\{[^}]*opacity\s*:\s*([0-9]*\.?[0-9]+)\s*;/i.exec(css)
  return regla?.[1] === undefined ? 1 : Number.parseFloat(regla[1])
}

function componerSobre(frente: string, fondo: string, alfa: number): string {
  const canalMezclado = (indice: number): string =>
    Math.round(canal(frente, indice) * alfa + canal(fondo, indice) * (1 - alfa))
      .toString(16)
      .padStart(2, "0")
  return `#${canalMezclado(1)}${canalMezclado(3)}${canalMezclado(5)}`
}

function aLineal(canal: number): number {
  const proporcion = canal / 255
  return proporcion <= 0.03928 ? proporcion / 12.92 : ((proporcion + 0.055) / 1.055) ** 2.4
}

function canal(hex: string, inicio: number): number {
  const par = hex.slice(inicio, inicio + 2)
  if (par.length !== 2) {
    throw new Error(`Color hexadecimal ilegible: ${hex}`)
  }
  return Number.parseInt(par, 16)
}

/** Luminancia relativa segun WCAG 2.1. */
function luminancia(hex: string): number {
  return (
    0.2126 * aLineal(canal(hex, 1)) +
    0.7152 * aLineal(canal(hex, 3)) +
    0.0722 * aLineal(canal(hex, 5))
  )
}

function contraste(unColor: string, otroColor: string): number {
  const uno = luminancia(unColor)
  const otro = luminancia(otroColor)
  return (Math.max(uno, otro) + 0.05) / (Math.min(uno, otro) + 0.05)
}

/** Valor real de una variable del CSS servido; en oscuro, dentro del bloque `prefers-color-scheme`. */
function valorDeMapa(nombre: string, oscuro: boolean): string {
  const bloque = oscuro ? ESTILOS.slice(ESTILOS.indexOf("prefers-color-scheme: dark")) : ESTILOS
  const coincidencia = new RegExp(`${nombre}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(bloque)
  const valor = coincidencia?.[1]
  if (valor === undefined) {
    throw new Error(`No encontre la variable ${nombre} (oscuro=${oscuro})`)
  }
  return valor
}

/** Contraste tal y como se ve de verdad: si hay opacidad, se compone antes de medir. */
function contrasteVisible(frente: string, fondo: string, opacidad: number): number {
  return contraste(componerSobre(frente, fondo, opacidad), fondo)
}

describe("Mapa: contraste con los numeros, no a ojo", () => {
  for (const oscuro of [false, true]) {
    const tema = oscuro ? "oscuro" : "claro"

    it(`debe superar ${MINIMO_TEXTO}:1 la etiqueta activa en el tema ${tema}`, () => {
      const tinta = valorDeMapa("--mapa-mesa-tinta", oscuro)
      const fondo = valorDeMapa("--mapa-mesa-fondo", oscuro)
      expect(contraste(tinta, fondo)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
    })

    it(`debe superar ${MINIMO_TEXTO}:1 la etiqueta desactivada en el tema ${tema}`, () => {
      const tinta = valorDeMapa("--mapa-inactiva-tinta", oscuro)
      const fondo = valorDeMapa("--mapa-inactiva-fondo", oscuro)
      const raya = valorDeMapa("--mapa-inactiva-raya", oscuro)
      expect(contraste(tinta, fondo)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      expect(contraste(tinta, raya)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
    })

    it(`debe separar la mesa de la celda al menos ${MINIMO_GRAFICO}:1 en el tema ${tema}`, () => {
      const mesa = valorDeMapa("--mapa-mesa-fondo", oscuro)
      const celda = valorDeMapa("--mapa-celda-fondo", oscuro)
      expect(contraste(mesa, celda)).toBeGreaterThanOrEqual(MINIMO_GRAFICO)
    })
  }

  // Apagar el texto con `opacity` es justo el defecto que dejo la mesa desactivada ilegible.
  // La raya y el borde ya la distinguen; no hace falta bajar la opacidad de toda la fila.
  it("no debe apagar la fila desactivada con opacity: se lee en el mapa de color, no en el DOM de color", () => {
    expect(leerOpacidadDeLista(ESTILOS)).toBe(1)
  })

  describe("lista de mesas: el estado desactivado tambien se mide", () => {
    for (const oscuro of [false, true]) {
      const tema = oscuro ? "oscuro" : "claro"
      const opacidad = leerOpacidadDeLista(ESTILOS)
      const inactiva = valorDeMapa("--mapa-inactiva-fondo", oscuro)

      it(`debe superar ${MINIMO_TEXTO}:1 la etiqueta desactivada en la lista, tema ${tema}`, () => {
        const tinta = valorDeMapa("--mapa-inactiva-tinta", oscuro)
        expect(contrasteVisible(tinta, inactiva, opacidad)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      })

      it(`debe superar ${MINIMO_TEXTO}:1 el codigo desactivado en la lista, tema ${tema}`, () => {
        const tinta = valorDeMapa("--mapa-inactiva-tinta", oscuro)
        expect(contrasteVisible(tinta, inactiva, opacidad)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      })

      it(`debe superar ${MINIMO_TEXTO}:1 el texto «desactivada» en la lista, tema ${tema}`, () => {
        const tintaSuave = valorDeMapa("--tinta-suave", oscuro)
        expect(contrasteVisible(tintaSuave, inactiva, opacidad)).toBeGreaterThanOrEqual(
          MINIMO_TEXTO,
        )
      })
    }
  })

  // La prueba tiene que saber fallar: con el color malo de antes (texto al 60 % sobre blanco)
  // el mismo calculo cae por debajo del minimo. Si esto deja de caer, la guardia era decorativa.
  it("debe saber fallar cuando la tinta desactivada se apaga con opacity", () => {
    expect(contrasteVisible("#55555e", "#ffffff", 0.6)).toBeLessThan(MINIMO_TEXTO)
  })
})
