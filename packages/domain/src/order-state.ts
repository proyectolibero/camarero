/**
 * Los estados de la comanda y sus transiciones permitidas (CONTRACT-estados-comanda, D-010).
 *
 * Esta es la UNICA fuente de verdad de la maquina de estados. El panel la usa para decidir
 * que botones dibuja y para validar el destino antes de escribir; los tests la recorren
 * entera. No se retrocede: un estado solo avanza hacia adelante o pasa a `anulada`, que es
 * terminal, igual que `cerrada`.
 */

export const ESTADOS_DE_COMANDA = [
  "pendiente",
  "aceptada",
  "preparando",
  "lista",
  "servida",
  "cerrada",
  "anulada",
] as const

export type EstadoDeComanda = (typeof ESTADOS_DE_COMANDA)[number]

/** Estado terminal: no admite ninguna transicion. */
export const ESTADO_ANULADO: EstadoDeComanda = "anulada"

/**
 * Matriz de transiciones. Es EXACTAMENTE la tabla de CONTRACT-estados-comanda: cualquier
 * cambio aqui es un cambio de contrato y exige registrar la decision.
 */
const TRANSICIONES: Readonly<Record<EstadoDeComanda, readonly EstadoDeComanda[]>> = {
  pendiente: ["aceptada", "anulada"],
  aceptada: ["preparando", "anulada"],
  preparando: ["lista", "anulada"],
  lista: ["servida", "anulada"],
  servida: ["cerrada", "anulada"],
  cerrada: [],
  anulada: [],
}

/** Reconoce un estado de comanda a partir de un texto. */
export function esEstadoDeComanda(valor: string): valor is EstadoDeComanda {
  return (ESTADOS_DE_COMANDA as readonly string[]).includes(valor)
}

/** Estados a los que puede pasar una comanda que esta en `actual`. */
export function estadosPermitidos(actual: EstadoDeComanda): readonly EstadoDeComanda[] {
  return TRANSICIONES[actual]
}

/** Verdadero si `desde` puede pasar a `hacia` sin saltarse la maquina de estados. */
export function transicionPermitida(desde: EstadoDeComanda, hacia: EstadoDeComanda): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

/** El siguiente estado natural de avance, o null si la comanda ya es terminal. */
export function siguienteEstado(actual: EstadoDeComanda): EstadoDeComanda | null {
  const avance = TRANSICIONES[actual].find((estado) => estado !== ESTADO_ANULADO)
  return avance ?? null
}
