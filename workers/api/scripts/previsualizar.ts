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

const ZONA_TERRAZA: Zona = { id: "z1", nombre: "Terraza", kind: "terraza", mesas: 7 }

function mesa(parcial: Partial<Mesa>): Mesa {
  return {
    id: "m1",
    codigo: "ABCDEFGH",
    etiqueta: "Mesa",
    capacidad: 4,
    kind: "mesa",
    activa: true,
    zonaId: "z1",
    zonaNombre: "Terraza",
    posFila: 0,
    posColumna: 0,
    ...parcial,
  }
}

const MESAS: readonly Mesa[] = [
  mesa({ id: "m1", etiqueta: "Barra 1", capacidad: 2, posFila: 0, posColumna: 0 }),
  mesa({ id: "m2", etiqueta: "Mesa 2", posFila: 0, posColumna: 1 }),
  mesa({ id: "m3", etiqueta: "Mesa 3", posFila: 0, posColumna: 2 }),
  mesa({ id: "m4", etiqueta: "Terraza 12", capacidad: 6, posFila: 0, posColumna: 3 }),
  mesa({ id: "m5", etiqueta: "Mesa 5", posFila: 1, posColumna: 0 }),
  mesa({
    id: "m6",
    etiqueta: "Mesa 6",
    codigo: "JKLMNPQR",
    activa: false,
    posFila: 1,
    posColumna: 1,
  }),
  mesa({ id: "m7", etiqueta: "Mesa 7", posFila: 1, posColumna: 2 }),
]

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
    renderizar(vistaMesas(DUENO, MESAS, [ZONA_TERRAZA], true, { exito: "Mesa movida." })),
  ),
)

process.stdout.write(`Previsualizacion escrita en ${SALIDA}\n`)
