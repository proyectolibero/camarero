/**
 * Conversion entre bytes y base64url (RFC 4648 §5).
 *
 * Los tokens JWT y los hashes viajan en base64url: sin relleno y con `-` y `_` en lugar de
 * `+` y `/`. Se centraliza aqui para que el verificador de tokens y el de PIN no repitan la
 * misma conversion con dos estilos distintos.
 */
const codificador = new TextEncoder()

export function aBytes(texto: string): Uint8Array<ArrayBuffer> {
  // Se copia a un Uint8Array nuevo para anclar el tipo al ArrayBuffer: las funciones de
  // Web Crypto exigen BufferSource y no aceptan un Uint8Array generico.
  return new Uint8Array(codificador.encode(texto))
}

export function base64UrlABytes(segmento: string): Uint8Array<ArrayBuffer> {
  const base64 = segmento.replaceAll("-", "+").replaceAll("_", "/")
  const relleno = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const binario = atob(relleno)
  const bytes = new Uint8Array(binario.length)
  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice)
  }
  return bytes
}

export function bytesABase64Url(bytes: Uint8Array): string {
  let binario = ""
  for (const byte of bytes) {
    binario += String.fromCharCode(byte)
  }
  return btoa(binario).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

/** Comparacion en tiempo constante: no filtra cuantos bytes coinciden. */
export function compararEnTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diferencia = 0
  for (let indice = 0; indice < a.length; indice += 1) {
    diferencia |= (a[indice] ?? 0) ^ (b[indice] ?? 0)
  }
  return diferencia === 0
}
