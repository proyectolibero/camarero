/**
 * Tipos de `jsqr` para las pruebas.
 *
 * La declaracion oficial declara `export default` pero el paquete es CommonJS, y con
 * `moduleResolution: nodenext` TypeScript deja de ver la funcion como invocable. Este shim
 * minimo se queda en las pruebas: `jsqr` NO es dependencia de produccion, la usa solo el test
 * que decodifica el QR generado. Se declara unicamente lo que el test consume.
 */
declare module "jsqr" {
  type Punto = { readonly x: number; readonly y: number }

  interface CodigoQr {
    readonly data: string
    readonly version: number
    readonly location: {
      readonly topLeftCorner: Punto
      readonly topRightCorner: Punto
      readonly bottomLeftCorner: Punto
      readonly bottomRightCorner: Punto
    }
  }

  interface Opciones {
    readonly inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst"
  }

  function jsQR(
    datos: Uint8ClampedArray,
    ancho: number,
    alto: number,
    opciones?: Opciones,
  ): CodigoQr | null

  export default jsQR
}
