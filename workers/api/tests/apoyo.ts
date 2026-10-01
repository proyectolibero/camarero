/**
 * Apoyo comun de las pruebas del panel: firma de pasaportes y construccion de peticiones.
 *
 * Las claves se generan en cada prueba y no se toca la red: el manejador del borde recibe
 * la fuente de claves inyectada. El contexto de la base tambien se inyecta (un almacen
 * falso), de modo que ninguna prueba de rutas necesita Postgres.
 */
import { aBytes, bytesABase64Url } from "../src/auth/base64.ts"
import type { ClaveDeFirma } from "../src/auth/jwks.ts"
import type { AlmacenComensal } from "../src/comensal/datos.ts"
import type { AlmacenCartas } from "../src/panel/cartas.ts"
import type { AlmacenPanel } from "../src/panel/datos.ts"

export const AHORA = new Date("2026-09-30T12:00:00.000Z")
export const KID = "clave-de-prueba"
export const ENTORNO = {
  SUPABASE_URL: "https://proyecto.test",
  DOMINIO_PUBLICO: "https://camarero.proyectolibero.org",
  BASE: { connectionString: "postgres://no-se-usa-en-las-pruebas" },
}

export type Firmante = {
  readonly clave: ClaveDeFirma
  readonly tokenPara: (sub: string) => Promise<string>
}

export async function crearFirmante(): Promise<Firmante> {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])
  const clave: ClaveDeFirma = {
    kid: KID,
    alg: "ES256",
    jwk: await crypto.subtle.exportKey("jwk", par.publicKey),
  }
  async function tokenPara(sub: string): Promise<string> {
    const cabecera = bytesABase64Url(aBytes(JSON.stringify({ alg: "ES256", typ: "JWT", kid: KID })))
    const exp = Math.floor(AHORA.getTime() / 1000) + 3600
    const cuerpo = bytesABase64Url(aBytes(JSON.stringify({ sub, exp })))
    const firma = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      par.privateKey,
      aBytes(`${cabecera}.${cuerpo}`),
    )
    return `${cabecera}.${cuerpo}.${bytesABase64Url(new Uint8Array(firma))}`
  }
  return { clave, tokenPara }
}

export type OpcionesPeticion = {
  readonly method?: string
  readonly cookie?: string
  readonly cookieMesa?: string
  readonly cookieCesta?: string
  readonly formulario?: Readonly<Record<string, string>>
}

export function peticion(ruta: string, opciones: OpcionesPeticion = {}): Request {
  const cabeceras = new Headers()
  const cookies: string[] = []
  if (opciones.cookie !== undefined) {
    cookies.push(`camarero_sesion=${opciones.cookie}`)
  }
  if (opciones.cookieMesa !== undefined) {
    cookies.push(`camarero_mesa=${opciones.cookieMesa}`)
  }
  if (opciones.cookieCesta !== undefined) {
    cookies.push(`camarero_cesta=${opciones.cookieCesta}`)
  }
  if (cookies.length > 0) {
    cabeceras.set("cookie", cookies.join("; "))
  }
  let cuerpo: string | undefined
  if (opciones.formulario !== undefined) {
    cabeceras.set("content-type", "application/x-www-form-urlencoded")
    cuerpo = new URLSearchParams(opciones.formulario).toString()
  }
  return new Request(`https://camarero.test${ruta}`, {
    method: opciones.method ?? "GET",
    headers: cabeceras,
    body: cuerpo,
  })
}

/** Almacen de comensal falso: por defecto, todo codigo es desconocido. */
export function comensalFalso(parciales: Partial<AlmacenComensal> = {}): AlmacenComensal {
  const desconocido = async (): Promise<{ readonly tipo: "codigo_desconocido" }> => ({
    tipo: "codigo_desconocido",
  })
  return {
    abrir: desconocido,
    pedir: desconocido,
    enviar: async () => ({ tipo: "codigo_desconocido" }),
    pedidos: async () => ({ tipo: "codigo_desconocido" }),
    ...parciales,
  }
}

/**
 * Almacen inyectable con respuestas sensatas por defecto. Cada prueba sobrescribe solo lo
 * que le importa; asi anadir un metodo nuevo al contrato no rompe las pruebas anteriores.
 */
export function almacenFalso(parciales: Partial<AlmacenPanel> = {}): AlmacenPanel {
  return {
    leerLocal: async () => null,
    actualizarLocal: async () => ({ ok: true, valor: undefined }),
    listarZonas: async () => [],
    crearZona: async () => ({ ok: true, valor: undefined }),
    listarMesas: async () => [],
    crearMesa: async () => ({ ok: false, motivo: "conflicto" }),
    alternarMesa: async () => ({ ok: true, valor: undefined }),
    leerMesa: async () => null,
    moverMesa: async () => ({ ok: true }),
    acomodarMesasSinPosicion: async () => undefined,
    listarCategorias: async () => [],
    leerCategoria: async () => null,
    crearCategoria: async () => ({ ok: false, motivo: "conflicto" }),
    alternarCategoria: async () => ({ ok: true, valor: undefined }),
    renombrarCategoria: async () => ({ ok: true, valor: undefined }),
    moverCategoria: async () => ({ ok: true, valor: undefined }),
    listarPlatos: async () => [],
    leerPlato: async () => null,
    crearPlato: async () => ({ ok: false, motivo: "conflicto" }),
    actualizarPlato: async () => ({ ok: true, valor: undefined }),
    alternarPlato: async () => ({ ok: true, valor: undefined }),
    moverPlato: async () => ({ ok: true, valor: undefined }),
    fijarFoto: async () => ({ ok: true, valor: null }),
    contarParejasPendientes: async () => 0,
    listarParejasPendientes: async () => [],
    aprobarPareja: async () => ({ ok: true, valor: undefined }),
    rechazarPareja: async () => ({ ok: true, valor: undefined }),
    listarComandas: async () => [],
    cambiarEstadoComanda: async () => ({ ok: false, motivo: "no_existe" }),
    listarSala: async () => [],
    listarComandasDeMesa: async () => [],
    ...parciales,
  }
}

/** Almacen de fotos en memoria: guarda bytes y tipo, para probar sin tocar R2. */
export function cartasFalsas(iniciales: Readonly<Record<string, string>> = {}): {
  readonly almacen: AlmacenCartas
  readonly objetos: Map<string, { readonly bytes: ArrayBuffer; readonly tipo: string }>
} {
  const objetos = new Map<string, { readonly bytes: ArrayBuffer; readonly tipo: string }>()
  for (const [clave, texto] of Object.entries(iniciales)) {
    objetos.set(clave, { bytes: aArrayBuffer(new TextEncoder().encode(texto)), tipo: "image/png" })
  }
  const almacen: AlmacenCartas = {
    disponible: true,
    guardar: async (clave, bytes, tipo) => {
      objetos.set(clave, { bytes: aArrayBuffer(bytes), tipo })
    },
    leer: async (clave) => {
      const objeto = objetos.get(clave)
      if (objeto === undefined) {
        return null
      }
      const respuesta = new Response(objeto.bytes)
      return { cuerpo: respuesta.body ?? new ReadableStream(), tipo: objeto.tipo }
    },
    borrar: async (clave) => {
      objetos.delete(clave)
    },
  }
  return { almacen, objetos }
}

function aArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  return copia.buffer
}
