/**
 * El sistema de tokens y los cinco modelos.
 *
 * Dos capas, para que un tema cambie por ALIAS y no reescribiendo componentes:
 *
 *   1. Capa cruda (`--crudo-*`): los valores literales de un modelo y un modo. Es lo unico que
 *      cambia entre modelos.
 *   2. Capa de alias (`--superficie`, `--acento`, `--texto-suave`...): nombres semanticos que
 *      apuntan a la capa cruda. Los componentes SOLO usan alias; nunca un hex.
 *
 * Un modelo aporta un juego de crudos para el modo claro y otro para el oscuro. El alias no se
 * toca. La identidad del local (modelo y acento) se guarda como DATO y se materializa aqui.
 */
import { esHex, tintaSobre } from "./contraste.ts"

/** Nombres crudos de un modelo. La familia, no el color: el valor es lo que cambia. */
export type Crudos = {
  readonly fondo: string
  readonly superficie: string
  readonly superficieTenue: string
  readonly tinta: string
  readonly tintaSuave: string
  readonly borde: string
  readonly bordeFuerte: string
  readonly raya: string
  readonly acento: string
  readonly sobreAcento: string
  readonly error: string
  readonly errorFondo: string
  readonly exito: string
  readonly exitoFondo: string
  readonly avisoFondo: string
  readonly avisoBorde: string
  readonly qr: string
}

export type Modelo = {
  readonly nombre: string
  readonly claro: Crudos
  readonly oscuro: Crudos
  /** Si es true, el modelo es oscuro aunque el sistema pida modo claro (Nocturno). */
  readonly siempreOscuro?: boolean
}

export type NombreModelo = "sobrio" | "calido" | "moderno" | "nocturno" | "verde"

/** Orden en el que se presentan al humano para elegir viendolos. */
export const NOMBRES_MODELO: readonly NombreModelo[] = [
  "sobrio",
  "calido",
  "moderno",
  "nocturno",
  "verde",
]

export const MODELO_POR_DEFECTO: NombreModelo = "sobrio"

export function esNombreModelo(valor: string): valor is NombreModelo {
  return (NOMBRES_MODELO as readonly string[]).includes(valor)
}

// ---------------------------------------------------------------------------
// Los cinco modelos aprobados por el humano
// ---------------------------------------------------------------------------

const SOBRIO_CLARO: Crudos = {
  fondo: "#f6f6f4",
  superficie: "#ffffff",
  superficieTenue: "#e7e9eb",
  tinta: "#1b1b1f",
  tintaSuave: "#55555e",
  borde: "#d9d9d1",
  bordeFuerte: "#6b7076",
  raya: "#9aa0a6",
  acento: "#1f6b4a",
  sobreAcento: "#ffffff",
  error: "#8f1d1d",
  errorFondo: "#fbecec",
  exito: "#14532d",
  exitoFondo: "#e8f5ec",
  avisoFondo: "#fff7e0",
  avisoBorde: "#e0b13a",
  qr: "#ffffff",
}
const SOBRIO_OSCURO: Crudos = {
  fondo: "#16161a",
  superficie: "#1e1e24",
  superficieTenue: "#2a2a31",
  tinta: "#ececf1",
  tintaSuave: "#a8a8b3",
  borde: "#33333c",
  bordeFuerte: "#8a8a93",
  raya: "#5a5a63",
  acento: "#4fae7e",
  sobreAcento: "#0f1b14",
  error: "#ffb4b4",
  errorFondo: "#3a1e1e",
  exito: "#b6e6c6",
  exitoFondo: "#17301f",
  avisoFondo: "#3a2f10",
  avisoBorde: "#b98a20",
  qr: "#ffffff",
}

const CALIDO_CLARO: Crudos = {
  fondo: "#fbf6ef",
  superficie: "#fffdf9",
  superficieTenue: "#f0e6d7",
  tinta: "#33241a",
  tintaSuave: "#6b5544",
  borde: "#e6d8c6",
  bordeFuerte: "#8a7358",
  raya: "#b09a80",
  acento: "#9a4a1f",
  sobreAcento: "#ffffff",
  error: "#8a1f1f",
  errorFondo: "#fbe9e3",
  exito: "#1f5a39",
  exitoFondo: "#e6f0e2",
  avisoFondo: "#fdf1d6",
  avisoBorde: "#cf9a3a",
  qr: "#ffffff",
}
const CALIDO_OSCURO: Crudos = {
  fondo: "#1d1712",
  superficie: "#2a221b",
  superficieTenue: "#332a21",
  tinta: "#f3e9dd",
  tintaSuave: "#c2ab97",
  borde: "#40352a",
  bordeFuerte: "#7d6a55",
  raya: "#8f7a62",
  acento: "#e09a63",
  sobreAcento: "#241206",
  error: "#ffc0ad",
  errorFondo: "#3a201a",
  exito: "#bcd9a8",
  exitoFondo: "#1f3020",
  avisoFondo: "#3a2f16",
  avisoBorde: "#c69a4a",
  qr: "#ffffff",
}

const MODERNO_CLARO: Crudos = {
  fondo: "#f4f6fa",
  superficie: "#ffffff",
  superficieTenue: "#e8ecf3",
  tinta: "#111827",
  tintaSuave: "#4b5563",
  borde: "#d5dae3",
  bordeFuerte: "#7b8496",
  raya: "#9aa4b5",
  acento: "#1d4ed8",
  sobreAcento: "#ffffff",
  error: "#b91c1c",
  errorFondo: "#fdeaea",
  exito: "#047857",
  exitoFondo: "#e3f5ee",
  avisoFondo: "#fef3c7",
  avisoBorde: "#d1a12b",
  qr: "#ffffff",
}
const MODERNO_OSCURO: Crudos = {
  fondo: "#0d1117",
  superficie: "#161b22",
  superficieTenue: "#1c232c",
  tinta: "#e6edf3",
  tintaSuave: "#9aa7b4",
  borde: "#2b333d",
  bordeFuerte: "#6b7686",
  raya: "#5a6472",
  acento: "#6ea8fe",
  sobreAcento: "#08131f",
  error: "#ff9e9e",
  errorFondo: "#3a1d1d",
  exito: "#7ee2b8",
  exitoFondo: "#123027",
  avisoFondo: "#322a12",
  avisoBorde: "#c9a23a",
  qr: "#ffffff",
}

// Nocturno es oscuro por definicion: su modo "claro" tambien es nocturno, de modo que el
// local que lo elige lo ve oscuro aunque el sistema operativo pida modo claro.
const NOCTURNO: Crudos = {
  fondo: "#121016",
  superficie: "#1c1a22",
  superficieTenue: "#26232f",
  tinta: "#ece9f2",
  tintaSuave: "#a9a4b6",
  borde: "#322f3d",
  bordeFuerte: "#6f6a80",
  raya: "#5c5768",
  acento: "#b98cf0",
  sobreAcento: "#1a1226",
  error: "#ffb3c1",
  errorFondo: "#3a1c26",
  exito: "#9fe3c0",
  exitoFondo: "#142e24",
  avisoFondo: "#322a14",
  avisoBorde: "#c9a23a",
  qr: "#ffffff",
}

const VERDE_CLARO: Crudos = {
  fondo: "#f2f7f0",
  superficie: "#ffffff",
  superficieTenue: "#e2efe0",
  tinta: "#14261a",
  tintaSuave: "#46614f",
  borde: "#cfe0ce",
  bordeFuerte: "#6f8a75",
  raya: "#8fa896",
  acento: "#1d6b3a",
  sobreAcento: "#ffffff",
  error: "#9b1c1c",
  errorFondo: "#fbeaea",
  exito: "#14532d",
  exitoFondo: "#e4f3e6",
  avisoFondo: "#fdf3d4",
  avisoBorde: "#cfa63a",
  qr: "#ffffff",
}
const VERDE_OSCURO: Crudos = {
  fondo: "#0e1711",
  superficie: "#16241a",
  superficieTenue: "#1d2d22",
  tinta: "#e4f0e6",
  tintaSuave: "#9db6a3",
  borde: "#2a3b2f",
  bordeFuerte: "#657a6a",
  raya: "#556b5b",
  acento: "#74d39a",
  sobreAcento: "#08170e",
  error: "#ffb3b3",
  errorFondo: "#381d1d",
  exito: "#a9e6bd",
  exitoFondo: "#12301d",
  avisoFondo: "#2f2a12",
  avisoBorde: "#c6a244",
  qr: "#ffffff",
}

export const MODELOS: Readonly<Record<NombreModelo, Modelo>> = {
  sobrio: { nombre: "Sobrio", claro: SOBRIO_CLARO, oscuro: SOBRIO_OSCURO },
  calido: { nombre: "Cálido", claro: CALIDO_CLARO, oscuro: CALIDO_OSCURO },
  moderno: { nombre: "Moderno", claro: MODERNO_CLARO, oscuro: MODERNO_OSCURO },
  nocturno: { nombre: "Nocturno", claro: NOCTURNO, oscuro: NOCTURNO, siempreOscuro: true },
  verde: { nombre: "Verde", claro: VERDE_CLARO, oscuro: VERDE_OSCURO },
}

export function modeloDe(nombre: string): Modelo {
  return esNombreModelo(nombre) ? MODELOS[nombre] : MODELOS[MODELO_POR_DEFECTO]
}

// ---------------------------------------------------------------------------
// Materializacion a CSS
// ---------------------------------------------------------------------------

/**
 * Alias semanticos: los componentes usan ESTOS nombres. Las claves de la capa cruda se
 * reescriben por modelo, pero los alias son estables, que es lo que pide ADR-0035.
 */
export const ALIAS: Readonly<Record<string, string>> = {
  "--fondo": "--crudo-fondo",
  "--superficie": "--crudo-superficie",
  "--superficie-tenue": "--crudo-superficie-tenue",
  "--papel": "--superficie",
  "--texto": "--crudo-tinta",
  "--tinta": "--texto",
  "--texto-suave": "--crudo-tinta-suave",
  "--tinta-suave": "--texto-suave",
  "--borde": "--crudo-borde",
  "--borde-fuerte": "--crudo-borde-fuerte",
  "--acento": "--crudo-acento",
  "--sobre-acento": "--crudo-sobre-acento",
  "--acento-tinta": "--sobre-acento",
  "--error": "--crudo-error",
  "--error-fondo": "--crudo-error-fondo",
  "--exito": "--crudo-exito",
  "--exito-fondo": "--crudo-exito-fondo",
  "--aviso-fondo": "--crudo-aviso-fondo",
  "--aviso-borde": "--crudo-aviso-borde",
  "--qr-fondo": "--crudo-qr",
  // El mapa y la sala no tienen colores propios: reutilizan los alias. Asi un modelo nuevo
  // no obliga a tocar cada pantalla.
  "--mapa-celda-fondo": "--fondo",
  "--mapa-celda-borde": "--borde",
  "--mapa-mesa-fondo": "--acento",
  "--mapa-mesa-borde": "--superficie",
  "--mapa-mesa-tinta": "--sobre-acento",
  "--mapa-inactiva-fondo": "--superficie-tenue",
  "--mapa-inactiva-raya": "--crudo-raya",
  "--mapa-inactiva-borde": "--borde-fuerte",
  "--mapa-inactiva-tinta": "--texto",
  "--sala-libre-fondo": "--superficie-tenue",
  "--sala-libre-tinta": "--texto",
  "--sala-espera-fondo": "--aviso-fondo",
  "--sala-espera-tinta": "--texto",
  "--sala-pendiente-fondo": "--acento",
  "--sala-pendiente-tinta": "--sobre-acento",
  "--sala-servido-fondo": "--exito-fondo",
  "--sala-servido-tinta": "--exito",
  "--alerta-fondo": "--acento",
  "--alerta-tinta": "--sobre-acento",
}

const CRUDOS_POR_ALIAS: Readonly<Record<string, keyof Crudos>> = {
  "--crudo-fondo": "fondo",
  "--crudo-superficie": "superficie",
  "--crudo-superficie-tenue": "superficieTenue",
  "--crudo-tinta": "tinta",
  "--crudo-tinta-suave": "tintaSuave",
  "--crudo-borde": "borde",
  "--crudo-borde-fuerte": "bordeFuerte",
  "--crudo-raya": "raya",
  "--crudo-acento": "acento",
  "--crudo-sobre-acento": "sobreAcento",
  "--crudo-error": "error",
  "--crudo-error-fondo": "errorFondo",
  "--crudo-exito": "exito",
  "--crudo-exito-fondo": "exitoFondo",
  "--crudo-aviso-fondo": "avisoFondo",
  "--crudo-aviso-borde": "avisoBorde",
  "--crudo-qr": "qr",
}

/** Un acento valido es un hex de seis cifras; cualquier otra cosa se descarta sin inventar. */
function acentoValido(acento: string | undefined): string | null {
  return acento !== undefined && esHex(acento) ? acento : null
}

function bloqueCrudos(crudos: Crudos): string {
  const lineas = Object.entries(CRUDOS_POR_ALIAS).map(([variable, clave]) => {
    const valor = crudos[clave]
    if (!esHex(valor)) {
      throw new Error(`El modelo trae un color ilegible en ${clave}: ${valor}`)
    }
    return `  ${variable}: ${valor};`
  })
  return lineas.join("\n")
}

function bloqueAlias(): string {
  return Object.entries(ALIAS)
    .map(([variable, destino]) => `  ${variable}: var(${destino});`)
    .join("\n")
}

/**
 * CSS del tema para un modelo y, opcionalmente, un acento propio del local. El acento se
 * aplica a los dos modos y su tinta se recalcula para que un acento claro no deje texto blanco
 * ilegible. La misma funcion sirve para la hoja por defecto y para la hoja que se genera por
 * local: no hay dos maneras de pintar el tema.
 */
export function temaCss(nombre: string, acento?: string): string {
  const modelo = modeloDe(nombre)
  const acentoClaro = acentoValido(acento) ?? modelo.claro.acento
  const acentoOscuro = acentoValido(acento) ?? modelo.oscuro.acento
  const claro: Crudos = {
    ...modelo.claro,
    acento: acentoClaro,
    sobreAcento: tintaSobre(acentoClaro),
  }
  const oscuro: Crudos = {
    ...modelo.oscuro,
    acento: acentoOscuro,
    sobreAcento: tintaSobre(acentoOscuro),
  }
  const esquema = modelo.siempreOscuro === true ? "dark" : "light dark"
  const medio =
    modelo.siempreOscuro === true
      ? ""
      : `\n@media (prefers-color-scheme: dark) {\n:root {\n${bloqueCrudos(oscuro)}\n}\n}`
  return `:root {\n  color-scheme: ${esquema};\n${bloqueCrudos(claro)}\n${bloqueAlias()}\n}${medio}`
}
