/**
 * Plantillas de HTML: el escapado por defecto.
 *
 * Es la cerradura que impide que un dato de la base (nombre de local, alias) se convierta en
 * etiquetas dentro del navegador. Se prueban los cinco caracteres con significado y la marca
 * explicita que autoriza insertar HTML ya construido.
 */
import { describe, expect, it } from "vitest"
import { escapar, html, htmlCrudo, renderizar } from "../src/ui/html.ts"

describe("Plantilla html: escapado por defecto", () => {
  it("debe escapar una etiqueta de script interpolada", () => {
    const salida = renderizar(html`<p>${"<script>alert(1)</script>"}</p>`)
    expect(salida).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>")
    expect(salida).not.toContain("<script>")
  })

  it("debe escapar comillas dobles y simples", () => {
    expect(renderizar(html`${'"'}`)).toBe("&quot;")
    expect(renderizar(html`${"'"}`)).toBe("&#39;")
  })

  it("debe escapar el ampersand y los angulos", () => {
    expect(renderizar(html`${"a & b < c > d"}`)).toBe("a &amp; b &lt; c &gt; d")
  })

  it("debe tratar null y undefined como cadena vacia", () => {
    expect(renderizar(html`[${null}][${undefined}]`)).toBe("[][]")
  })

  it("no debe volver a escapar un fragmento ya construido", () => {
    const interior = html`<strong>${"<b>"}</strong>`
    const salida = renderizar(html`<p>${interior}</p>`)
    expect(salida).toBe("<p><strong>&lt;b&gt;</strong></p>")
  })

  it("debe unir una lista de fragmentos sin separador", () => {
    const items = ["uno", "dos"].map((texto) => html`<li>${texto}</li>`)
    expect(renderizar(html`<ul>${items}</ul>`)).toBe("<ul><li>uno</li><li>dos</li></ul>")
  })

  it("debe insertar sin escapar solo con la marca explicita", () => {
    expect(renderizar(html`${htmlCrudo("<b>negrita</b>")}`)).toBe("<b>negrita</b>")
    expect(renderizar(html`${"<b>negrita</b>"}`)).toBe("&lt;b&gt;negrita&lt;/b&gt;")
  })

  it("debe escapar los cinco caracteres con la funcion suelta", () => {
    expect(escapar(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;")
  })
})
