/**
 * Validacion de los formularios del panel, en el servidor.
 *
 * Los mismos valores que imponen los `check` de las migraciones (0002) se comprueban aqui
 * ANTES de tocar la base: asi el dueno ve un mensaje claro en espanol en lugar de un error
 * de restriccion. No sustituye a la base: el `check` sigue siendo la ultima palabra.
 *
 * Cada funcion valida UN campo y devuelve un resultado explicito (nunca lanza para un dato
 * esperado malo). Ninguna confia en el navegador: el HTML puede mentir.
 */

export type Valido<T> = { readonly ok: true; readonly valor: T }
export type Invalido = { readonly ok: false; readonly error: string }
export type Validacion<T> = Valido<T> | Invalido

export function valido<T>(valor: T): Valido<T> {
  return { ok: true, valor }
}

export function invalido(error: string): Invalido {
  return { ok: false, error }
}

export type EstadoLocal = "draft" | "active" | "paused"
export type ModoDeServicio = "dine_in" | "delivery" | "both"
export type TipoDeZona = "sala" | "barra" | "terraza" | "delivery"
export type TipoDeMesa = "mesa" | "barra"

export const LARGO_NOMBRE_MAXIMO = 120
export const CAPACIDAD_MINIMA = 1
export const CAPACIDAD_MAXIMA = 99

const ESTADOS: readonly EstadoLocal[] = ["draft", "active", "paused"]
const MODOS: readonly ModoDeServicio[] = ["dine_in", "delivery", "both"]
const TIPOS_DE_ZONA: readonly TipoDeZona[] = ["sala", "barra", "terraza", "delivery"]
const TIPOS_DE_MESA: readonly TipoDeMesa[] = ["mesa", "barra"]

function esUnoDe<T extends string>(permitidos: readonly T[], valor: string): valor is T {
  return (permitidos as readonly string[]).includes(valor)
}

/** Nombre legible: no vacio y de largo razonable. Vale para local, zona y etiqueta de mesa. */
export function validarNombre(campo: string, valor: string): Validacion<string> {
  const limpio = valor.trim()
  if (limpio === "") {
    return invalido(`El ${campo} no puede quedar vacío.`)
  }
  if (limpio.length > LARGO_NOMBRE_MAXIMO) {
    return invalido(`El ${campo} no puede pasar de ${LARGO_NOMBRE_MAXIMO} caracteres.`)
  }
  return valido(limpio)
}

/**
 * Zona horaria IANA. Se comprueba con `Intl`, que conoce la base de zonas: preferimos
 * rechazar un valor inventado a guardarlo y que las horas del local salgan mal.
 */
export function validarZonaHoraria(valor: string): Validacion<string> {
  const limpio = valor.trim()
  if (limpio === "") {
    return invalido("La zona horaria no puede quedar vacía.")
  }
  try {
    new Intl.DateTimeFormat("es-CL", { timeZone: limpio })
  } catch {
    return invalido("Esa zona horaria no se reconoce. Usa un nombre como America/Santiago.")
  }
  return valido(limpio)
}

export function validarEstado(valor: string): Validacion<EstadoLocal> {
  return esUnoDe(ESTADOS, valor) ? valido(valor) : invalido("El estado del local no es válido.")
}

export function validarModoDeServicio(valor: string): Validacion<ModoDeServicio> {
  return esUnoDe(MODOS, valor) ? valido(valor) : invalido("El modo de servicio no es válido.")
}

export function validarTipoDeZona(valor: string): Validacion<TipoDeZona> {
  return esUnoDe(TIPOS_DE_ZONA, valor) ? valido(valor) : invalido("El tipo de zona no es válido.")
}

export function validarTipoDeMesa(valor: string): Validacion<TipoDeMesa> {
  return esUnoDe(TIPOS_DE_MESA, valor) ? valido(valor) : invalido("El tipo de mesa no es válido.")
}

/** Capacidad: entero entre 1 y 99. No se acepta signo, coma ni espacio en blanco. */
export function validarCapacidad(valor: string): Validacion<number> {
  const limpio = valor.trim()
  if (!/^[0-9]{1,3}$/.test(limpio)) {
    return invalido("La capacidad tiene que ser un número entero.")
  }
  const numero = Number.parseInt(limpio, 10)
  if (numero < CAPACIDAD_MINIMA || numero > CAPACIDAD_MAXIMA) {
    return invalido(`La capacidad tiene que estar entre ${CAPACIDAD_MINIMA} y ${CAPACIDAD_MAXIMA}.`)
  }
  return valido(numero)
}
