/**
 * La cesta del comensal vive en una cookie que solo lleva identificadores y cantidades.
 *
 * NUNCA lleva precios (D-051): el precio y el nombre los fija la base desde la carta al
 * enviar. Si alguien manipula la cookie, puede cambiar QUE pide y CUANTO, pero no el precio.
 * Este modulo es puro (parsear, serializar y aplicar acciones); no toca la base ni el borde.
 */
import { type LineaDeImporte, subtotalDeLineas } from "@camarero/domain"

export const NOMBRE_COOKIE_CESTA = "camarero_cesta"

/** Tope de lineas distintas: por encima, el envio se rechaza antes de tocar la base. */
export const MAX_LINEAS = 50

/** Tope de unidades por linea: evita cantidades absurdas en un solo toque. */
export const MAX_CANTIDAD = 99

/** Cuatro horas, la misma vida que la sesion de mesa. */
const MAX_AGE_SEGUNDOS = 4 * 60 * 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SEPARADOR_LINEA = "."
const SEPARADOR_CANTIDAD = ":"

export type LineaDeCesta = {
  readonly platoId: string
  readonly cantidad: number
}

export type AccionDeCesta = "subir" | "bajar" | "quitar"

function limitarCantidad(valor: number): number {
  if (!Number.isFinite(valor)) {
    return 1
  }
  return Math.min(MAX_CANTIDAD, Math.max(1, Math.trunc(valor)))
}

/**
 * Lee la cookie de la cesta. Cualquier trozo que no sea un identificador y una cantidad
 * validos se descarta en silencio: la cookie es del cliente y puede venir manipulada.
 */
export function leerCesta(valor: string | null): readonly LineaDeCesta[] {
  if (valor === null || valor === "") {
    return []
  }
  const lineas: LineaDeCesta[] = []
  for (const trozo of valor.split(SEPARADOR_LINEA)) {
    const [platoId, cantidadTexto] = trozo.split(SEPARADOR_CANTIDAD)
    if (platoId === undefined || cantidadTexto === undefined || !UUID.test(platoId)) {
      continue
    }
    const cantidad = Number.parseInt(cantidadTexto, 10)
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      continue
    }
    lineas.push({ platoId, cantidad: limitarCantidad(cantidad) })
    if (lineas.length >= MAX_LINEAS) {
      break
    }
  }
  return lineas
}

/** Serializa la cesta a un valor de cookie: `id:cantidad.id:cantidad`. */
export function serializarCesta(lineas: readonly LineaDeCesta[]): string {
  return lineas
    .map((linea) => `${linea.platoId}${SEPARADOR_CANTIDAD}${linea.cantidad}`)
    .join(SEPARADOR_LINEA)
}

/**
 * Anade una cantidad a un plato. Si ya estaba, suma; si es nuevo, lo agrega. Respeta el tope
 * de lineas distintas: lo que no cabe se ignora, no se abre una cesta sin limite.
 */
export function agregarALaCesta(
  lineas: readonly LineaDeCesta[],
  platoId: string,
  cantidad: number,
): readonly LineaDeCesta[] {
  if (!UUID.test(platoId)) {
    return lineas
  }
  const incremento = limitarCantidad(cantidad)
  const indice = lineas.findIndex((linea) => linea.platoId === platoId)
  if (indice === -1) {
    return lineas.length >= MAX_LINEAS ? lineas : [...lineas, { platoId, cantidad: incremento }]
  }
  const actual = lineas[indice]
  if (actual === undefined) {
    return lineas
  }
  const copia = [...lineas]
  copia[indice] = { platoId, cantidad: limitarCantidad(actual.cantidad + incremento) }
  return copia
}

/**
 * Sube, baja o quita una linea. Bajar una linea de 1 la quita: en la pantalla no existe el
 * cero, y dejar una linea a cero seria una comanda con una linea fantasma.
 */
export function ajustarLaCesta(
  lineas: readonly LineaDeCesta[],
  platoId: string,
  accion: AccionDeCesta,
): readonly LineaDeCesta[] {
  if (accion === "quitar") {
    return lineas.filter((linea) => linea.platoId !== platoId)
  }
  return lineas.flatMap((linea) => {
    if (linea.platoId !== platoId) {
      return [linea]
    }
    const cantidad = accion === "subir" ? linea.cantidad + 1 : linea.cantidad - 1
    return cantidad < 1 ? [] : [{ platoId, cantidad: limitarCantidad(cantidad) }]
  })
}

/** Precios de la carta indexados por plato, lo unico que puede fijar el total. */
export type PreciosDeCarta = ReadonlyMap<string, number>

/**
 * Resuelve la cesta contra la carta: devuelve el nombre y el precio que la base dice, y el
 * subtotal. Los platos que ya no estan en la carta (o no son visibles) se descartan: no se
 * inventa un precio que la base no confirma.
 */
export type LineaResuelta = {
  readonly platoId: string
  readonly nombre: string
  readonly cantidad: number
  readonly precioClp: number
  readonly totalClp: number
}

export function resolverCesta(
  lineas: readonly LineaDeCesta[],
  nombreYprecio: ReadonlyMap<string, { readonly nombre: string; readonly precioClp: number }>,
): { readonly lineas: readonly LineaResuelta[]; readonly totalClp: number } {
  const resueltas: LineaResuelta[] = []
  for (const linea of lineas) {
    const plato = nombreYprecio.get(linea.platoId)
    if (plato === undefined) {
      continue
    }
    resueltas.push({
      platoId: linea.platoId,
      nombre: plato.nombre,
      cantidad: linea.cantidad,
      precioClp: plato.precioClp,
      totalClp: plato.precioClp * linea.cantidad,
    })
  }
  return { lineas: resueltas, totalClp: subtotalDeLineas(resueltas.map(aImporte)) }
}

function aImporte(linea: LineaResuelta): LineaDeImporte {
  return { precioClp: linea.precioClp, cantidad: linea.cantidad }
}

/**
 * Cookie de la cesta: opaca para el navegador, solo por HTTPS y con caducidad. El valor solo
 * usa identificadores, digitos y los separadores `.` y `:`, todos validos en una cookie, asi
 * que no se codifica: el valor que se lee es el que se escribio.
 */
export function cookieDeCesta(valor: string): string {
  return [
    `${NOMBRE_COOKIE_CESTA}=${valor}`,
    `Max-Age=${MAX_AGE_SEGUNDOS}`,
    "Path=/t",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ")
}

/** Vaciar la cesta es escribirla vacia: el envio no deja restos en el dispositivo. */
export function cookieDeCestaVacia(): string {
  return cookieDeCesta("")
}

/** Token de idempotencia del envio: alta entropia, generado por el borde en cada cesta. */
export function tokenDeEnvio(): string {
  return crypto.randomUUID()
}
