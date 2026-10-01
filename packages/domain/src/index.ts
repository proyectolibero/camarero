export {
  type LineaConTotal,
  type LineaDeImporte,
  subtotalDeLineas,
  totalDeLineas,
} from "./dinero.ts"
export {
  esPantallaTodos,
  nombreDePuesto,
  PANTALLA_TODOS,
  type PlatoConPuesto,
  type PuestoDelLocal,
  type PuestoDePantalla,
} from "./estaciones.ts"
export {
  ESTADO_ANULADO,
  ESTADOS_DE_COMANDA,
  type EstadoDeComanda,
  esEstadoDeComanda,
  estadosPermitidos,
  siguienteEstado,
  transicionPermitida,
} from "./order-state.ts"
