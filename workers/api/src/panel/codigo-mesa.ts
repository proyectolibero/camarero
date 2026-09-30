/**
 * Codigo de mesa: 8 caracteres que se dictan por telefono sin confusion.
 *
 * El alfabeto es base32 SIN `0`, `O`, `1` ni `I`, porque esos cuatro se confunden al oido
 * (el `0` con la `O`, el `1` con la `I`). Es exactamente el que impone el `check`
 * `tables_code_formato` de la migracion 0002. El codigo no se escribe a mano: lo genera el
 * sistema y es unico por local; si choca, el llamante reintenta.
 */

export const ALFABETO_MESA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const LONGITUD_CODIGO_MESA = 8

/** Mismo patron que el `check` de la base: mantener los dos sincronizados. */
export const PATRON_CODIGO_MESA = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

/** Restriccion de unicidad por local que denuncia un choque de codigo en Postgres. */
const RESTRICCION_CODIGO = "tables_location_code_unico"

/**
 * Genera un codigo nuevo. Se toma un byte por caracter: 256 es multiplo exacto de 32, asi
 * que el reparto por modulo no tiene sesgo y cada caracter sale con la misma probabilidad.
 * No es un secreto: solo tiene que ser irrepetible y dictable.
 */
export function generarCodigoMesa(): string {
  const bytes = new Uint8Array(LONGITUD_CODIGO_MESA)
  crypto.getRandomValues(bytes)
  let codigo = ""
  for (const byte of bytes) {
    codigo += ALFABETO_MESA[byte % ALFABETO_MESA.length]
  }
  return codigo
}

/** true si el error de Postgres es un choque del codigo unico por local. */
export function esConflictoDeCodigo(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  const { code, constraint } = error as { readonly code?: unknown; readonly constraint?: unknown }
  return code === "23505" && constraint === RESTRICCION_CODIGO
}
