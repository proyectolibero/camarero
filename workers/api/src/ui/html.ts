/**
 * Plantillas de HTML con escapado por defecto.
 *
 * El panel se dibuja en el servidor (ADR-0023) y parte de su contenido sale de la base de
 * datos (nombres de local, de organizacion, de empleado). Si se interpolara sin escapar, un
 * nombre con etiquetas se convertiria en ejecucion dentro del navegador del dueno. Por eso
 * esta es la unica via de escribir HTML y escapa siempre; no existe `innerHTML` en el panel.
 *
 * Para introducir un fragmento ya construido hace falta una marca explicita (`htmlCrudo`),
 * de modo que "no escapar" sea una decision visible y no un descuido.
 */

const SEGURO = Symbol("html-seguro")

/** Fragmento de HTML ya construido y de confianza, marcado explicitamente. */
export type HtmlSeguro = { readonly [SEGURO]: true; readonly valor: string }

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** Escapa los cinco caracteres con significado dentro de HTML. */
export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter] ?? caracter)
}

/** Marca un texto como HTML ya construido. Es la unica forma de no escapar una interpolacion. */
export function htmlCrudo(valor: string): HtmlSeguro {
  return { [SEGURO]: true, valor }
}

function esSeguro(valor: unknown): valor is HtmlSeguro {
  return typeof valor === "object" && valor !== null && SEGURO in valor
}

function interpolar(valor: unknown): string {
  if (esSeguro(valor)) {
    return valor.valor
  }
  if (Array.isArray(valor)) {
    return valor.map((elemento) => interpolar(elemento)).join("")
  }
  if (valor === null || valor === undefined) {
    return ""
  }
  return escapar(String(valor))
}

/** Plantilla etiquetada: escapa por defecto toda interpolacion. */
export function html(fragmentos: TemplateStringsArray, ...valores: readonly unknown[]): HtmlSeguro {
  const partes: string[] = []
  fragmentos.forEach((fragmento, indice) => {
    partes.push(fragmento)
    if (indice < valores.length) {
      partes.push(interpolar(valores[indice]))
    }
  })
  return htmlCrudo(partes.join(""))
}

/** Devuelve el texto final de un fragmento ya construido. */
export function renderizar(fragmento: HtmlSeguro): string {
  return fragmento.valor
}
