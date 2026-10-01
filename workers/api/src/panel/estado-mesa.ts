/**
 * El estado de una mesa en la sala, calculado a partir de sus senales (D-053).
 *
 * Es puro: no toca la base ni el HTML, asi que se prueba sin dobles. El orden de prioridad es
 * el que define el producto: si alguien esta pidiendo emparejarse, eso salta antes que nada
 * (es la barrera que abre o cierra el pedido); despues, una sesion aprobada con comandas sin
 * servir; despues, una sesion aprobada con todo servido; y si no hay sesion aprobada, la mesa
 * esta libre. La aprobacion es lo que abre la mesa: una sesion sin aprobar no ocupa la mesa.
 */
import type { EstadoDeMesa, ResumenDeMesa } from "./datos.ts"

export const ESTADOS_DE_MESA = [
  "libre",
  "esperando_aprobacion",
  "comandas_pendientes",
  "todo_servido",
] as const

/** Etiqueta en palabras: es lo que se lee cuando el color no basta. */
export const ETIQUETA_ESTADO_MESA: Readonly<Record<EstadoDeMesa, string>> = {
  libre: "Libre",
  esperando_aprobacion: "Esperando aprobación",
  comandas_pendientes: "Con comandas pendientes",
  todo_servido: "Todo servido",
}

/** Glifo de forma: distingue el estado sin depender del color (vacío para la mesa libre). */
export const GLIFO_ESTADO_MESA: Readonly<Record<EstadoDeMesa, string>> = {
  libre: "",
  esperando_aprobacion: "?",
  comandas_pendientes: "!",
  todo_servido: "✓",
}

/** Explicacion corta para la leyenda de la sala. */
export const DESCRIPCION_ESTADO_MESA: Readonly<Record<EstadoDeMesa, string>> = {
  libre: "Sin sesión abierta: la mesa está disponible.",
  esperando_aprobacion: "Un comensal ha escaneado el QR y espera aprobación para pedir.",
  comandas_pendientes: "Hay comandas sin servir en esta mesa.",
  todo_servido: "La sesión está abierta y no queda nada pendiente de servir.",
}

export function estadoDeMesa(resumen: ResumenDeMesa): EstadoDeMesa {
  if (resumen.solicitudId !== null) {
    return "esperando_aprobacion"
  }
  if (!resumen.sesionActiva) {
    return "libre"
  }
  return resumen.comandasSinServir > 0 ? "comandas_pendientes" : "todo_servido"
}
