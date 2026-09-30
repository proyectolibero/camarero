/**
 * Genera la previsualizacion estatica del panel (LL-020: lo que se VE se mira).
 *
 * No reinventa nada: llama a las MISMAS funciones de renderizado que sirve el Worker
 * (`vistaEntrada`, `vistaMesas`, `ESTILOS`) y solo cambia el enlace de la hoja de estilos
 * a una ruta relativa, porque esto se abre con `file://` y alli `/panel/estilos.css` no
 * resuelve. El resto del HTML es byte a byte el de produccion. La carpeta de salida esta
 * en `.gitignore` y nunca se versiona.
 *
 * Uso: `node workers/api/scripts/previsualizar.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Empleado } from "../src/base.ts"
import { generarCodigoMesa } from "../src/panel/codigo-mesa.ts"
import type { Mesa, Zona } from "../src/panel/datos.ts"
import { vistaEntrada, vistaMesas } from "../src/panel/vistas.ts"
import { ESTILOS } from "../src/ui/estilos.ts"
import { renderizar } from "../src/ui/html.ts"

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url))
const SALIDA = join(RAIZ, ".previsualizacion")

const DUENO: Empleado = {
  staffId: "s-previsualizacion",
  correo: "duena@ejemplo.test",
  nombre: "Dueña de ejemplo",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Restaurante de ejemplo" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const ZONAS: readonly Zona[] = [
  { id: "z1", nombre: "Sala", kind: "sala", mesas: 5 },
  { id: "z2", nombre: "Barra", kind: "barra", mesas: 3 },
  { id: "z3", nombre: "Terraza", kind: "terraza", mesas: 4 },
]

/** El codigo no se inventa: lo genera el mismo generador que usa el alta de mesas. */
function mesa(parcial: Partial<Mesa>): Mesa {
  return {
    id: "m1",
    codigo: generarCodigoMesa(),
    etiqueta: "Mesa",
    capacidad: 4,
    kind: "mesa",
    activa: true,
    zonaId: "z1",
    zonaNombre: "Sala",
    posFila: 0,
    posColumna: 0,
    ...parcial,
  }
}

function enZona(zona: Zona, mesas: readonly Partial<Mesa>[]): readonly Mesa[] {
  return mesas.map((parcial) => mesa({ zonaId: zona.id, zonaNombre: zona.nombre, ...parcial }))
}

const SALA = ZONAS[0]
const BARRA = ZONAS[1]
const TERRAZA = ZONAS[2]
if (SALA === undefined || BARRA === undefined || TERRAZA === undefined) {
  throw new Error("Faltan zonas de previsualizacion")
}

// Cada mapa con SUS mesas: doce mesas en tres zonas, una desactivada y una de etiqueta larga.
const MESAS: readonly Mesa[] = [
  ...enZona(SALA, [
    { id: "s1", etiqueta: "Sala 1", capacidad: 2, posFila: 0, posColumna: 0 },
    { id: "s2", etiqueta: "Sala 2", capacidad: 4, posFila: 0, posColumna: 1 },
    { id: "s3", etiqueta: "Sala 3", capacidad: 4, posFila: 0, posColumna: 2 },
    { id: "s4", etiqueta: "Sala 4", capacidad: 6, posFila: 1, posColumna: 0 },
    { id: "s5", etiqueta: "Sala 5", capacidad: 2, posFila: 1, posColumna: 1 },
  ]),
  ...enZona(BARRA, [
    { id: "b1", etiqueta: "Barra 1", capacidad: 2, kind: "barra", posFila: 0, posColumna: 0 },
    { id: "b2", etiqueta: "Barra 2", capacidad: 2, kind: "barra", posFila: 0, posColumna: 1 },
    { id: "b3", etiqueta: "Barra 3", capacidad: 2, kind: "barra", posFila: 0, posColumna: 2 },
  ]),
  ...enZona(TERRAZA, [
    { id: "t1", etiqueta: "Terraza 1", capacidad: 4, posFila: 0, posColumna: 0 },
    { id: "t2", etiqueta: "Terraza 2", capacidad: 4, posFila: 0, posColumna: 1 },
    {
      id: "t3",
      etiqueta: "Terraza junto a la ventana grande",
      capacidad: 6,
      posFila: 0,
      posColumna: 2,
    },
    { id: "t4", etiqueta: "Terraza 4", capacidad: 4, activa: false, posFila: 0, posColumna: 3 },
  ]),
]

/** La previsualizacion ensena una mesa elegida para que se vean el mando y su etiqueta. */
const MESA_ELEGIDA = "t3"

/** En produccion la CSP permite la ruta absoluta; en `file://` hace falta una relativa. */
function conHojaDeEstilosRelativa(pagina: string): string {
  return pagina.replace('href="/panel/estilos.css"', 'href="estilos.css"')
}

function escribir(nombre: string, contenido: string): void {
  writeFileSync(join(SALIDA, nombre), contenido, "utf8")
}

mkdirSync(SALIDA, { recursive: true })

escribir("estilos.css", ESTILOS)
escribir("entrada.html", conHojaDeEstilosRelativa(renderizar(vistaEntrada("admin"))))
escribir(
  "mapa.html",
  conHojaDeEstilosRelativa(
    renderizar(vistaMesas(DUENO, MESAS, ZONAS, true, { exito: "Mesa movida." }, MESA_ELEGIDA)),
  ),
)

process.stdout.write(`Previsualizacion escrita en ${SALIDA}\n`)
