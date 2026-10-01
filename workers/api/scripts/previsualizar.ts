/**
 * Genera la previsualizacion estatica del panel (LL-020: lo que se VE se mira).
 *
 * No reinventa nada: llama a las MISMAS funciones de renderizado que sirve el Worker
 * (`vistaEntrada`, `vistaMesas`, `vistaCarta`, `vistaCategoria`, `ESTILOS`) y solo cambia el
 * enlace de la hoja de estilos y el de las fotos a rutas relativas, porque esto se abre con
 * `file://` o desde un servidor estatico local. El resto del HTML es byte a byte el de
 * produccion. La carpeta de salida esta en `.gitignore` y nunca se versiona: la imagen de
 * prueba se genera aqui, no vive en el repositorio.
 *
 * Uso: `node workers/api/scripts/previsualizar.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { crc32, deflateSync } from "node:zlib"
import type { Empleado } from "../src/base.ts"
import type { LineaResuelta } from "../src/comensal/cesta.ts"
import type { CartaDelComensal, PedidoDelComensal } from "../src/comensal/datos.ts"
import {
  vistaCartaComensal,
  vistaCestaComensal,
  vistaCodigoDesconocido,
  vistaLocalInactivo,
  vistaPedidosComensal,
} from "../src/comensal/vistas.ts"
import { generarCodigoMesa } from "../src/panel/codigo-mesa.ts"
import type {
  Categoria,
  ComandaDePuesto,
  Mesa,
  Plato,
  Puesto,
  ResumenDeMesa,
  SolicitudPendiente,
  Zona,
} from "../src/panel/datos.ts"
import {
  vistaCarta,
  vistaCategoria,
  vistaCocina,
  vistaDetalleMesa,
  vistaEntrada,
  vistaMesas,
  vistaParejas,
  vistaPlato,
  vistaPuestos,
  vistaSala,
} from "../src/panel/vistas.ts"
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

// ---------------------------------------------------------------------------
// La carta de ejemplo: tres categorias, nueve fichas, dos con foto.
// ---------------------------------------------------------------------------

const CATEGORIAS: readonly Categoria[] = [
  { id: "c1", nombre: "Entrantes", orden: 0, activa: true, disponible: true, puestoId: "pu-frio" },
  {
    id: "c2",
    nombre: "Principales",
    orden: 1,
    activa: true,
    disponible: true,
    puestoId: "pu-parrilla",
  },
  { id: "c3", nombre: "Bebidas", orden: 2, activa: true, disponible: true, puestoId: "pu-barra" },
]

/** Los puestos que nombra el dueno, con uno por defecto y la barra naciendo aceptada. */
const PUESTOS: readonly Puesto[] = [
  {
    id: "pu-cocina",
    nombre: "Cocina",
    orden: 0,
    activo: true,
    autoAcepta: false,
    porDefecto: true,
  },
  { id: "pu-frio", nombre: "Frío", orden: 1, activo: true, autoAcepta: false, porDefecto: false },
  {
    id: "pu-parrilla",
    nombre: "Parrilla",
    orden: 2,
    activo: true,
    autoAcepta: false,
    porDefecto: false,
  },
  {
    id: "pu-postre",
    nombre: "Postre",
    orden: 3,
    activo: true,
    autoAcepta: false,
    porDefecto: false,
  },
  { id: "pu-barra", nombre: "Barra", orden: 4, activo: true, autoAcepta: true, porDefecto: false },
]

const FOTO_CEVICHE = "foto-ceviche.png"
const FOTO_LOMO = "foto-lomo.png"

function plato(parcial: Partial<Plato> & { readonly id: string; readonly nombre: string }): Plato {
  return {
    categoriaId: "c1",
    descripcion: null,
    precioClp: 0,
    fotoClave: null,
    allergens: [],
    tags: [],
    puestoId: null,
    disponible: true,
    desde: null,
    hasta: null,
    orden: 0,
    activo: true,
    ...parcial,
  }
}

const PLATOS: readonly Plato[] = [
  plato({
    id: "p1",
    nombre: "Ceviche clásico",
    descripcion: "Corvina, limón de pica, cebolla morada y cilantro.",
    precioClp: 8900,
    fotoClave: FOTO_CEVICHE,
    allergens: ["pescado", "sulfitos"],
    categoriaId: "c1",
  }),
  plato({
    id: "p2",
    nombre: "Empanadas de queso",
    precioClp: 5000,
    disponible: false,
    allergens: ["gluten", "leche"],
    tags: ["vegetariano"],
    categoriaId: "c1",
  }),
  plato({
    id: "p3",
    nombre: "Tabla de quesos del sur",
    precioClp: 12500,
    activo: false,
    allergens: ["leche"],
    tags: ["vegetariano"],
    categoriaId: "c1",
  }),
  plato({
    id: "p4",
    nombre: "Lomo a lo pobre",
    descripcion: "Con papas fritas, huevo y cebolla caramelizada.",
    precioClp: 15900,
    fotoClave: FOTO_LOMO,
    allergens: ["huevo"],
    categoriaId: "c2",
  }),
  plato({
    id: "p5",
    nombre: "Pastel de choclo",
    precioClp: 11900,
    categoriaId: "c2",
  }),
  plato({
    id: "p6",
    nombre: "Cazuela de ave con un nombre larguísimo para ver cómo se comporta la ficha",
    precioClp: 10900,
    categoriaId: "c2",
  }),
  plato({
    id: "p7",
    nombre: "Pisco sour",
    descripcion: "Pisco, limón, azúcar y clara de huevo.",
    precioClp: 5900,
    puestoId: "pu-barra",
    allergens: ["huevo", "sulfitos"],
    categoriaId: "c3",
  }),
  plato({
    id: "p8",
    nombre: "Copa de vino de la casa",
    precioClp: 4500,
    allergens: ["sulfitos"],
    categoriaId: "c3",
  }),
  plato({
    id: "p9",
    nombre: "Agua mineral",
    precioClp: 2500,
    categoriaId: "c3",
  }),
]

function platosDe(categoriaId: string): readonly Plato[] {
  return PLATOS.filter((ficha) => ficha.categoriaId === categoriaId)
}

// ---------------------------------------------------------------------------
// Imagen de prueba: un PNG de verdad, generado aqui y jamas versionado.
// ---------------------------------------------------------------------------

const FIRMA_PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])

function concatenar(trozos: readonly Uint8Array[]): Uint8Array {
  const total = trozos.reduce((suma, trozo) => suma + trozo.byteLength, 0)
  const salida = new Uint8Array(total)
  let posicion = 0
  for (const trozo of trozos) {
    salida.set(trozo, posicion)
    posicion += trozo.byteLength
  }
  return salida
}

function trozoPng(tipo: string, datos: Uint8Array): Uint8Array {
  // largo(4) + tipo(4) + datos + crc(4) = 12 + datos.
  const salida = new Uint8Array(12 + datos.byteLength)
  const vista = new DataView(salida.buffer)
  vista.setUint32(0, datos.byteLength)
  for (let i = 0; i < 4; i += 1) {
    salida[4 + i] = tipo.charCodeAt(i)
  }
  salida.set(datos, 8)
  vista.setUint32(8 + datos.byteLength, crc32(salida.subarray(4, 8 + datos.byteLength)) >>> 0)
  return salida
}

type Color = readonly [number, number, number]

function pngDePrueba(
  ancho: number,
  alto: number,
  color: (x: number, y: number) => Color,
): Uint8Array {
  const filas = new Uint8Array((ancho * 3 + 1) * alto)
  let posicion = 0
  for (let y = 0; y < alto; y += 1) {
    filas[posicion] = 0
    posicion += 1
    for (let x = 0; x < ancho; x += 1) {
      const [r, g, b] = color(x, y)
      filas[posicion] = r
      filas[posicion + 1] = g
      filas[posicion + 2] = b
      posicion += 3
    }
  }
  const ihdr = new Uint8Array(13)
  const vista = new DataView(ihdr.buffer)
  vista.setUint32(0, ancho)
  vista.setUint32(4, alto)
  ihdr[8] = 8
  ihdr[9] = 2
  return concatenar([
    FIRMA_PNG,
    trozoPng("IHDR", ihdr),
    trozoPng("IDAT", new Uint8Array(deflateSync(filas))),
    trozoPng("IEND", new Uint8Array()),
  ])
}

// ---------------------------------------------------------------------------
// Composicion y escritura
// ---------------------------------------------------------------------------

/** En produccion la CSP permite la ruta absoluta; en `file://` hace falta una relativa. */
function conHojaDeEstilosRelativa(pagina: string): string {
  return pagina.replace('href="/panel/estilos.css"', 'href="estilos.css"')
}

/** La foto se sirve en `/cartas/<clave>`; en local se resuelve al fichero de al lado. */
function conFotosRelativas(pagina: string): string {
  return pagina.replaceAll('src="/cartas/', 'src="')
}

/** El interior del `<main>` de una vista, para componer una pagina con varias secciones. */
function cuerpoPrincipal(pagina: string): string {
  const inicio = pagina.indexOf('<main class="contenedor">')
  const fin = pagina.indexOf("</main>", inicio)
  if (inicio === -1 || fin === -1) {
    throw new Error("La vista de previsualizacion no tiene <main>")
  }
  return pagina.slice(inicio, fin + "</main>".length)
}

function escribir(nombre: string, contenido: string | Uint8Array): void {
  writeFileSync(join(SALIDA, nombre), contenido)
}

mkdirSync(SALIDA, { recursive: true })

// Imagenes de prueba: dos patrones distintos, para que se vea que son fichas diferentes.
escribir(
  FOTO_CEVICHE,
  pngDePrueba(320, 220, (x, y) => [40 + (x % 120), 120 + (y % 90), 90] as const),
)
escribir(
  FOTO_LOMO,
  pngDePrueba(320, 220, (x, y) => [180, 90 + (x % 120), 60 + (y % 90)] as const),
)

escribir("estilos.css", ESTILOS)
escribir("entrada.html", conHojaDeEstilosRelativa(renderizar(vistaEntrada("admin"))))
escribir(
  "mapa.html",
  conHojaDeEstilosRelativa(
    renderizar(vistaMesas(DUENO, MESAS, ZONAS, true, { exito: "Mesa movida." }, MESA_ELEGIDA)),
  ),
)

// `carta.html`: el indice de categorias seguido de cada categoria con sus fichas.
const indice = renderizar(vistaCarta(DUENO, CATEGORIAS, PUESTOS, true, { creada: true }))
const secciones = CATEGORIAS.map((categoria) =>
  cuerpoPrincipal(
    renderizar(vistaCategoria(DUENO, categoria, platosDe(categoria.id), PUESTOS, true, {})),
  ),
)
const cartaCompleta = conFotosRelativas(
  conHojaDeEstilosRelativa(
    indice.replace(cuerpoPrincipal(indice), cuerpoPrincipal(indice) + secciones.join("\n")),
  ),
)
escribir("carta.html", cartaCompleta)

// `plato.html`: la ficha de edicion, con la subida de foto y los estados diferenciados.
const ceviche = PLATOS[0]
if (ceviche === undefined) {
  throw new Error("Falta el plato de previsualizacion")
}
escribir(
  "plato.html",
  conFotosRelativas(
    conHojaDeEstilosRelativa(
      renderizar(
        vistaPlato(
          DUENO,
          ceviche,
          CATEGORIAS,
          PUESTOS,
          { categoria: null, puestoId: null, bebida: false },
          {},
        ),
      ),
    ),
  ),
)

// `alta.html`: el formulario de alta con su campo de foto. La foto viaja en el MISMO envio.
escribir(
  "alta.html",
  conHojaDeEstilosRelativa(
    renderizar(
      vistaPlato(
        DUENO,
        null,
        CATEGORIAS,
        PUESTOS,
        { categoria: "c1", puestoId: null, bebida: false },
        {},
      ),
    ),
  ),
)

// `puestos.html`: la pantalla donde el dueno nombra, ordena, activa y auto-acepta sus puestos.
escribir(
  "puestos.html",
  conHojaDeEstilosRelativa(renderizar(vistaPuestos(DUENO, PUESTOS, true, { creado: true }))),
)

// ---------------------------------------------------------------------------
// El comensal: la carta de su mesa con el boton de emparejarse
// ---------------------------------------------------------------------------

const CARTA_COMENSAL: CartaDelComensal = {
  local: "Barra Uno",
  mesa: "Mesa 4",
  estado: "sin_pedir",
  restanteSegundos: 600,
  categorias: [
    {
      id: "c1",
      nombre: "Entrantes",
      platos: [
        {
          id: "p1",
          nombre: "Ceviche clásico",
          descripcion: "Corvina, limón de pica, cebolla morada y cilantro.",
          precioClp: 8900,
          fotoClave: FOTO_CEVICHE,
          puestoId: "pu-frio",
          puestoNombre: "Frío",
          autoAcepta: false,
        },
        {
          id: "p2",
          nombre: "Empanadas de queso",
          descripcion: "Tres unidades, masa de hojaldre.",
          precioClp: 5000,
          fotoClave: null,
          puestoId: "pu-parrilla",
          puestoNombre: "Parrilla",
          autoAcepta: false,
        },
      ],
    },
    {
      id: "c2",
      nombre: "Principales",
      platos: [
        {
          id: "p4",
          nombre: "Lomo a lo pobre",
          descripcion: "Con papas fritas, huevo y cebolla caramelizada.",
          precioClp: 15900,
          fotoClave: FOTO_LOMO,
          puestoId: "pu-parrilla",
          puestoNombre: "Parrilla",
          autoAcepta: false,
        },
      ],
    },
  ],
}

escribir(
  "comensal.html",
  conFotosRelativas(
    conHojaDeEstilosRelativa(renderizar(vistaCartaComensal(CARTA_COMENSAL, "ABCDEFGH"))),
  ),
)
escribir(
  "comensal-desconocido.html",
  conHojaDeEstilosRelativa(renderizar(vistaCodigoDesconocido())),
)
escribir("comensal-sin-abrir.html", conHojaDeEstilosRelativa(renderizar(vistaLocalInactivo())))

// ---------------------------------------------------------------------------
// Las solicitudes de emparejamiento pendientes en el panel
// ---------------------------------------------------------------------------

const SOLICITUDES: readonly SolicitudPendiente[] = [
  { id: "s1", mesa: "Mesa 4", pedidaHaceSegundos: 8, restanteSegundos: 592 },
  { id: "s2", mesa: "Barra 2", pedidaHaceSegundos: 24, restanteSegundos: 576 },
  {
    id: "s3",
    mesa: "Terraza junto a la ventana grande",
    pedidaHaceSegundos: 47,
    restanteSegundos: 553,
  },
]

escribir("parejas.html", conHojaDeEstilosRelativa(renderizar(vistaParejas(DUENO, SOLICITUDES, {}))))

// ---------------------------------------------------------------------------
// La cesta del comensal y la cocina (LL-020: lo que se ve se mira)
// ---------------------------------------------------------------------------

const LINEAS_CESTA: readonly LineaResuelta[] = [
  {
    platoId: "p1",
    nombre: "Ceviche clásico",
    cantidad: 2,
    precioClp: 8900,
    totalClp: 17800,
    puestoId: "pu-frio",
    puestoNombre: "Frío",
    autoAcepta: false,
  },
  {
    platoId: "p2",
    nombre: "Empanadas de queso",
    cantidad: 1,
    precioClp: 5000,
    totalClp: 5000,
    puestoId: "pu-parrilla",
    puestoNombre: "Parrilla",
    autoAcepta: false,
  },
  {
    platoId: "p4",
    nombre: "Lomo a lo pobre",
    cantidad: 1,
    precioClp: 15900,
    totalClp: 15900,
    puestoId: "pu-parrilla",
    puestoNombre: "Parrilla",
    autoAcepta: false,
  },
]
const TOTAL_CESTA = LINEAS_CESTA.reduce((suma, linea) => suma + linea.totalClp, 0)

escribir(
  "cesta.html",
  conHojaDeEstilosRelativa(
    renderizar(
      vistaCestaComensal(
        { ...CARTA_COMENSAL, estado: "aprobado" },
        "ABCDEFGH",
        LINEAS_CESTA,
        TOTAL_CESTA,
        { clave: "clave-de-ejemplo", puedeEnviar: true },
      ),
    ),
  ),
)

const COMANDAS: readonly ComandaDePuesto[] = [
  {
    id: "o1",
    mesa: "Mesa 4",
    puestoId: "pu-frio",
    destino: "Frío",
    estado: "pendiente",
    creadaHaceSegundos: 6,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2 }],
  },
  {
    id: "o2",
    mesa: "Barra 2",
    puestoId: "pu-parrilla",
    destino: "Parrilla",
    estado: "aceptada",
    creadaHaceSegundos: 95,
    lineas: [{ nombre: "Lomo a lo pobre", cantidad: 1 }],
  },
  {
    id: "o3",
    mesa: "Terraza junto a la ventana grande",
    puestoId: "pu-postre",
    destino: "Postre",
    estado: "preparando",
    creadaHaceSegundos: 240,
    lineas: [{ nombre: "Pastel de choclo", cantidad: 2 }],
  },
  {
    id: "o4",
    mesa: "Sala 1",
    puestoId: "pu-barra",
    destino: "Barra",
    estado: "aceptada",
    creadaHaceSegundos: 35,
    lineas: [{ nombre: "Pisco sour", cantidad: 2 }],
  },
  {
    id: "o5",
    mesa: "Sala 4",
    puestoId: "pu-barra",
    destino: "Barra",
    estado: "aceptada",
    creadaHaceSegundos: 9,
    lineas: [{ nombre: "Agua mineral", cantidad: 3 }],
  },
]

const COMANDAS_DE_COCINA = COMANDAS.filter((comanda) =>
  ["pu-frio", "pu-parrilla", "pu-postre", "pu-cocina"].includes(comanda.puestoId ?? ""),
)
const COMANDAS_DE_BARRA = COMANDAS.filter((comanda) => comanda.puestoId === "pu-barra")

escribir(
  "cocina.html",
  conHojaDeEstilosRelativa(
    renderizar(vistaCocina(DUENO, COMANDAS_DE_COCINA, "pu-frio", PUESTOS, {})),
  ),
)
escribir(
  "barra.html",
  conHojaDeEstilosRelativa(
    renderizar(vistaCocina(DUENO, COMANDAS_DE_BARRA, "pu-barra", PUESTOS, {})),
  ),
)
escribir(
  "todo.html",
  conHojaDeEstilosRelativa(renderizar(vistaCocina(DUENO, COMANDAS, "todo", PUESTOS, {}))),
)

// ---------------------------------------------------------------------------
// La pantalla del comensal con sus comandas hermanas (cocina y barra por separado).
// ---------------------------------------------------------------------------

const PEDIDOS_DEL_COMENSAL: readonly PedidoDelComensal[] = [
  {
    id: "o1",
    destino: "frio",
    estado: "pendiente",
    creadoHaceSegundos: 6,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2, totalClp: 17800 }],
    totalClp: 17800,
  },
  {
    id: "o4",
    destino: "bar",
    estado: "aceptada",
    creadoHaceSegundos: 35,
    lineas: [{ nombre: "Pisco sour", cantidad: 2, totalClp: 11800 }],
    totalClp: 11800,
  },
]

escribir(
  "comensal-pedidos.html",
  conHojaDeEstilosRelativa(
    renderizar(vistaPedidosComensal("Barra Uno", "Mesa 4", "ABCDEFGH", PEDIDOS_DEL_COMENSAL)),
  ),
)

// ---------------------------------------------------------------------------
// La sala: las mesas en los cuatro estados, y el detalle de una con sus comandas
// ---------------------------------------------------------------------------

function mesaDeSala(id: string): Mesa {
  const encontrada = MESAS.find((candidata) => candidata.id === id)
  if (encontrada === undefined) {
    throw new Error(`Falta la mesa ${id} de la previsualizacion`)
  }
  return encontrada
}

function resumenDeSala(
  id: string,
  sesionActiva: boolean,
  solicitudId: string | null,
  comandasSinServir: number,
): ResumenDeMesa {
  return { mesa: mesaDeSala(id), sesionActiva, solicitudId, comandasSinServir }
}

// Los cuatro estados, repartidos por las tres zonas, para que se vean a la vez.
const RESUMENES_SALA: readonly ResumenDeMesa[] = [
  resumenDeSala("s1", false, "pr-s1", 0), // esperando aprobacion
  resumenDeSala("s2", true, null, 2), // con comandas pendientes
  resumenDeSala("s3", true, null, 0), // todo servido
  resumenDeSala("s4", false, null, 0), // libre
  resumenDeSala("s5", false, null, 0), // libre
  resumenDeSala("b1", true, null, 1), // con comandas pendientes
  resumenDeSala("b2", false, null, 0), // libre
  resumenDeSala("b3", true, null, 0), // todo servido
  resumenDeSala("t1", false, null, 0), // libre
  resumenDeSala("t2", false, "pr-t2", 0), // esperando aprobacion
  resumenDeSala("t3", true, null, 3), // con comandas pendientes
  resumenDeSala("t4", false, null, 0), // desactivada (t4 nace inactiva)
]

escribir("sala.html", conHojaDeEstilosRelativa(renderizar(vistaSala(DUENO, RESUMENES_SALA, {}))))

const COMANDAS_DE_LA_MESA: readonly ComandaDePuesto[] = [
  {
    id: "o1",
    mesa: "Sala 2",
    puestoId: "pu-frio",
    destino: "Frío",
    estado: "pendiente",
    creadaHaceSegundos: 12,
    lineas: [
      { nombre: "Ceviche clásico", cantidad: 2 },
      { nombre: "Empanadas de queso", cantidad: 1 },
    ],
  },
  {
    id: "o4",
    mesa: "Sala 2",
    puestoId: "pu-barra",
    destino: "Barra",
    estado: "preparando",
    creadaHaceSegundos: 65,
    lineas: [{ nombre: "Pisco sour", cantidad: 2 }],
  },
]

escribir(
  "sala-mesa.html",
  conHojaDeEstilosRelativa(
    renderizar(
      vistaDetalleMesa(DUENO, resumenDeSala("s2", true, null, 2), COMANDAS_DE_LA_MESA, {}),
    ),
  ),
)

process.stdout.write(`Previsualizacion escrita en ${SALIDA}\n`)
