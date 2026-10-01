/**
 * Vocabulario de la carta que SI esta fijado por la base, con su etiqueta en español.
 *
 * `tags` los limita un `check` de `0004_carta.sql`: aqui viven sus valores exactos, para que
 * la pantalla ofrezca justo lo que la base acepta y el servidor valide con las mismas listas.
 * El PUESTO de preparacion ya NO es un vocabulario fijo: son datos del local (ADR-0034), y se
 * leen de `kitchen_stations`. Los `allergens` NO tienen `check` (el contrato no los enumera):
 * se ofrece el juego estandar de catorce y se guarda el `valor`; el resto es decision del local.
 */

export type Opcion = { readonly valor: string; readonly etiqueta: string }

/** Vista «sin categoría»: agrupa los platos que no tienen ninguna. No es una fila de la base. */
export const SIN_CATEGORIA = "sin-categoria"

/** Etiquetas del `check` de `menu_items_tags_valido`, tal cual. */
export const TAGS: readonly Opcion[] = [
  { valor: "vegetariano", etiqueta: "Vegetariano" },
  { valor: "vegano", etiqueta: "Vegano" },
  { valor: "sin_gluten", etiqueta: "Sin gluten" },
  { valor: "picante", etiqueta: "Picante" },
]

/** Alérgenos habituales. No los impone la base; se guardan como texto. */
export const ALERGENOS: readonly Opcion[] = [
  { valor: "gluten", etiqueta: "Gluten" },
  { valor: "crustaceos", etiqueta: "Crustáceos" },
  { valor: "huevo", etiqueta: "Huevo" },
  { valor: "pescado", etiqueta: "Pescado" },
  { valor: "leche", etiqueta: "Leche" },
  { valor: "frutos_secos", etiqueta: "Frutos secos" },
  { valor: "cacahuete", etiqueta: "Cacahuete" },
  { valor: "soja", etiqueta: "Soja" },
  { valor: "apio", etiqueta: "Apio" },
  { valor: "mostaza", etiqueta: "Mostaza" },
  { valor: "sesamo", etiqueta: "Sésamo" },
  { valor: "sulfitos", etiqueta: "Sulfitos" },
  { valor: "altramuces", etiqueta: "Altramuces" },
  { valor: "moluscos", etiqueta: "Moluscos" },
]

export function etiquetaDe(opciones: readonly Opcion[], valor: string): string {
  return opciones.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor
}

export function valoresDe(opciones: readonly Opcion[]): readonly string[] {
  return opciones.map((opcion) => opcion.valor)
}

/** Conserva solo los valores conocidos y sin repetir, en el orden del catalogo. */
export function depurarContraCatalogo(
  opciones: readonly Opcion[],
  valores: readonly string[],
): readonly string[] {
  const recibidos = new Set(valores)
  return valoresDe(opciones).filter((valor) => recibidos.has(valor))
}
