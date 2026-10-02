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

type MapaDeVariables = ReadonlyMap<string, string>

/** Extrae los pares `--variable: valor;` de un bloque del CSS. */
function variablesDe(bloque: string): MapaDeVariables {
  const mapa = new Map<string, string>()
  for (const coincidencia of bloque.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const nombre = coincidencia[1]
    const valor = coincidencia[2]
    if (nombre !== undefined && valor !== undefined) {
      mapa.set(nombre, valor.trim())
    }
  }
  return mapa
}

/**
 * El CSS tiene dos capas: crudos y alias. La base y el modo oscuro aportan crudos distintos,
 * mientras los alias siguen apuntando a los mismos nombres. El resolutor recorre los `var()`
 * hasta el hex, que es lo que de verdad llega al ojo.
 */
function capasDeCss(): { readonly base: MapaDeVariables; readonly oscuro: MapaDeVariables } {
  const base = /:root\s*\{([\s\S]*?)\n\}/.exec(ESTILOS)
  const oscuro =
    /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\}/.exec(ESTILOS)
  return { base: variablesDe(base?.[1] ?? ""), oscuro: variablesDe(oscuro?.[1] ?? "") }
}

/** Valor real de una variable del CSS servido, resolviendo los alias hasta el hex. */
function valorDeMapa(nombre: string, oscuro: boolean): string {
  const capas = capasDeCss()
  const paso = (variable: string, profundidad: number): string => {
    if (profundidad > 20) {
      throw new Error(`Cadena de var() demasiado larga en ${variable}`)
    }
    const valor = (oscuro ? capas.oscuro.get(variable) : undefined) ?? capas.base.get(variable)
    if (valor === undefined) {
      throw new Error(`No encontre la variable ${variable} (oscuro=${oscuro})`)
    }
    const referencia = /^var\((--[a-z0-9-]+)\)$/.exec(valor)
    if (referencia?.[1] !== undefined) {
      return paso(referencia[1], profundidad + 1)
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(valor)) {
      throw new Error(`La variable ${variable} no resuelve a un hex: ${valor}`)
    }
    return valor
  }
  return paso(nombre, 0)
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

describe("Sala: contraste de los cuatro estados (D-053)", () => {
  // Cada estado tiene su pareja tinta/fondo; se mide el texto real que sirve la hoja.
  const ESTADOS: ReadonlyArray<{ readonly estado: string; readonly prefijo: string }> = [
    { estado: "libre", prefijo: "sala-libre" },
    { estado: "esperando_aprobacion", prefijo: "sala-espera" },
    { estado: "comandas_pendientes", prefijo: "sala-pendiente" },
    { estado: "todo_servido", prefijo: "sala-servido" },
  ]

  for (const { estado, prefijo } of ESTADOS) {
    for (const oscuro of [false, true]) {
      const tema = oscuro ? "oscuro" : "claro"
      it(`debe superar ${MINIMO_TEXTO}:1 el texto del estado ${estado} en el tema ${tema}`, () => {
        const tinta = valorDeMapa(`--${prefijo}-tinta`, oscuro)
        const fondo = valorDeMapa(`--${prefijo}-fondo`, oscuro)
        expect(contraste(tinta, fondo)).toBeGreaterThanOrEqual(MINIMO_TEXTO)
      })
    }
  }

  it("debe saber fallar cuando un estado se queda por debajo del minimo", () => {
    // Blanco sobre el verde palido de "todo servido" seria ilegible: el mismo calculo lo caza.
    expect(contraste("#ffffff", "#e8f5ec")).toBeLessThan(MINIMO_TEXTO)
  })
})
