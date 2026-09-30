/**
 * Las fotos de la carta: validacion por contenido, almacen en R2 y servicio publico (ADR-0030).
 *
 * El borde es el unico que sube y sirve estas imagenes. Se valida por CONTENIDO (los primeros
 * bytes), no por la extension del fichero, porque la extension la elige quien sube: un SVG con
 * codigo dentro renombrado a .jpg es la trampa clasica. Solo se aceptan imagenes raster
 * (JPEG, PNG y WebP); el SVG se rechaza siempre.
 *
 * La clave es aleatoria y conserva la extension real, y el tipo de contenido se guarda como
 * METADATO del objeto: al servirlo no se adivina, se lee. La ruta `/cartas/<clave>` es publica
 * a proposito (el comensal tiene que ver la foto sin entrar); la clave aleatoria la mantiene
 * recogida.
 */
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"

export type TipoDeImagen = "image/jpeg" | "image/png" | "image/webp"

export const TIPOS_DE_IMAGEN: readonly TipoDeImagen[] = ["image/jpeg", "image/png", "image/webp"]

const EXTENSION: Readonly<Record<TipoDeImagen, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/** Límite de tamaño de una foto: 5 MB. Un original de movil ronda los 3-4 MB; mas es pesadez. */
export const LIMITE_FOTO_BYTES = 5 * 1024 * 1024

/** El cuerpo multipart lleva cabeceras y delimites: se comprueba antes de leer con holgura. */
export const LIMITE_CUERPO_BYTES = LIMITE_FOTO_BYTES + 128 * 1024

/** Bytes suficientes para reconocer las tres firmas (JPEG 3, PNG 8, WebP 12). */
export const LIMITE_CABECERA_BYTES = 16

/**
 * Reconoce el tipo por los primeros bytes. Devuelve null para cualquier otra cosa: un SVG
 * (empieza por `<`), un PDF, un ZIP o un fichero de texto renombrado a .jpg.
 */
export function tipoDeImagen(bytes: Uint8Array): TipoDeImagen | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

/** Clave aleatoria que conserva la extension real del tipo detectado. */
export function claveNueva(tipo: TipoDeImagen): string {
  return `${crypto.randomUUID()}.${EXTENSION[tipo]}`
}

/** Una clave valida es un nombre plano sin barras ni `..`: no hay rutas dentro del bucket. */
export function claveValida(clave: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(clave) && !clave.includes("..")
}

export type FotoServida = {
  readonly cuerpo: ReadableStream
  readonly tipo: string
}

/** Lo que el borde necesita de R2. Se inyecta para poder probar sin tocar Cloudflare. */
export type AlmacenCartas = {
  readonly disponible: boolean
  readonly guardar: (clave: string, bytes: Uint8Array, tipo: TipoDeImagen) => Promise<void>
  readonly leer: (clave: string) => Promise<FotoServida | null>
  readonly borrar: (clave: string) => Promise<void>
}

export type ObjetoR2 = {
  readonly body: ReadableStream
  readonly httpMetadata?: { readonly contentType?: string } | undefined
}

/** Superficie minima de un bucket R2 que usamos. No se inventa: `put`, `get` y `delete`. */
export type CuboR2 = {
  readonly put: (
    clave: string,
    valor: Uint8Array,
    opciones?: { readonly httpMetadata?: { readonly contentType?: string } } | undefined,
  ) => Promise<unknown>
  readonly get: (clave: string) => Promise<ObjetoR2 | null>
  readonly delete: (clave: string) => Promise<void>
}

const TIPOS_CONOCIDOS = new Set<string>(TIPOS_DE_IMAGEN)

/** El tipo guardado como metadato es lo unico de fiar al servir; si no cuadra, se descarga. */
function tipoDeContenido(valor: string | undefined): string {
  return valor !== undefined && TIPOS_CONOCIDOS.has(valor) ? valor : "application/octet-stream"
}

export function cartasDeR2(cubo: CuboR2): AlmacenCartas {
  return {
    disponible: true,
    guardar: async (clave, bytes, tipo) => {
      await cubo.put(clave, bytes, { httpMetadata: { contentType: tipo } })
    },
    leer: async (clave) => {
      const objeto = await cubo.get(clave)
      if (objeto === null) {
        return null
      }
      return { cuerpo: objeto.body, tipo: tipoDeContenido(objeto.httpMetadata?.contentType) }
    },
    borrar: async (clave) => {
      await cubo.delete(clave)
    },
  }
}

/** Sin binding CARTAS no hay almacen: se falla cerrado y se avisa en la pantalla. */
export function almacenCartasNoConfigurado(): AlmacenCartas {
  return {
    disponible: false,
    guardar: async () => undefined,
    leer: async () => null,
    borrar: async () => undefined,
  }
}

export function cartasDeEntorno(entorno: { readonly CARTAS?: CuboR2 | undefined }): AlmacenCartas {
  const cubo = entorno.CARTAS
  return cubo === undefined ? almacenCartasNoConfigurado() : cartasDeR2(cubo)
}

/** Respuesta de una foto: tipo fijo, nosniff y cache largo. Nunca se adivina el contenido. */
export function respuestaFoto(foto: FotoServida): Response {
  const cabeceras = new Headers()
  cabeceras.set("content-type", foto.tipo)
  cabeceras.set("x-content-type-options", "nosniff")
  cabeceras.set("cache-control", "public, max-age=31536000, immutable")
  cabeceras.set("content-security-policy", "default-src 'none'; sandbox")
  cabeceras.set("referrer-policy", "no-referrer")
  return new Response(foto.cuerpo, { headers: cabeceras })
}

const PREFIJO_FOTOS = "/cartas/"

/**
 * Sirve las fotos en `/cartas/<clave>`. Es publica a proposito: el comensal no tiene sesion.
 * Devuelve null si la ruta no es de fotos, para no pisar las superficies dinamicas.
 */
export async function manejarCartasPublicas(
  peticion: Request,
  url: URL,
  cartas: AlmacenCartas,
): Promise<Response | null> {
  if (url.pathname !== "/cartas" && !url.pathname.startsWith(PREFIJO_FOTOS)) {
    return null
  }
  if (peticion.method !== "GET") {
    return responderMetodoNoPermitido("GET")
  }
  const clave = decodeURIComponent(url.pathname.slice(PREFIJO_FOTOS.length))
  if (clave === "" || !claveValida(clave)) {
    return responderNoEncontrado()
  }
  const foto = await cartas.leer(clave)
  return foto === null ? responderNoEncontrado() : respuestaFoto(foto)
}
