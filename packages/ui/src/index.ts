/**
 * @camarero/ui — el sistema visual.
 *
 * Sin dependencias de terceros y sin framework: tokens en variables de CSS, cinco modelos y
 * los componentes basicos. El borde y el navegador consumen esto; nadie escribe un color a
 * mano en una pantalla (ADR-0035).
 */
export { CLASES_COMPONENTE, COMPONENTES_CSS } from "./componentes.ts"
export {
  contraste,
  esHex,
  luminancia,
  MINIMO_GRAFICO,
  MINIMO_TEXTO,
  tintaSobre,
} from "./contraste.ts"
export { ESTILOS, estilosDe } from "./estilos.ts"
export { detectarColoresLiterales } from "./guardia.ts"
export type { Crudos, Modelo, NombreModelo } from "./temas.ts"
export {
  ALIAS,
  esNombreModelo,
  MODELO_POR_DEFECTO,
  MODELOS,
  modeloDe,
  NOMBRES_MODELO,
  temaCss,
} from "./temas.ts"
