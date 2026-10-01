/**
 * Acceso del panel de gestion a la base de datos.
 *
 * Cada operacion abre una transaccion corta y fija el contexto `app.*` del empleado antes
 * de consultar: la RLS decide que filas se ven y que escrituras se aceptan. Las funciones
 * de `permisos.ts` solo deciden que se dibuja; la cerradura de verdad es esta capa, la base.
 *
 * Un fallo esperado de escritura (sin permiso, fila ausente, choque de codigo) se devuelve
 * como `Resultado`, nunca como excepcion. Un fallo inesperado (la base caida) si sube.
 */
import {
  destinosDelPuesto,
  type EstadoDeComanda,
  esEstadoDeComanda,
  type PuestoDePantalla,
  transicionPermitida,
} from "@camarero/domain"
import { Client } from "pg"
import { type ContextoDeEmpleado, type Empleado, fijarContextoDeEmpleado } from "../base.ts"
import { esConflictoDeCodigo, generarCodigoMesa } from "./codigo-mesa.ts"
import {
  type Celda,
  type Direccion,
  desplazar,
  dimensionesDeMapa,
  type Posicion,
  primerHuecoLibre,
} from "./mapa.ts"

export type DatosLocal = {
  readonly id: string
  readonly orgId: string
  readonly nombre: string
  readonly slug: string
  readonly timezone: string
  readonly currency: string
  readonly status: string
  readonly serviceMode: string
}

export type CambiosLocal = {
  readonly nombre: string
  readonly timezone: string
  readonly status: string
  readonly serviceMode: string
}

export type Zona = {
  readonly id: string
  readonly nombre: string
  readonly kind: string
  readonly mesas: number
}

export type NuevaZona = {
  readonly nombre: string
  readonly kind: string
}

export type Mesa = {
  readonly id: string
  readonly codigo: string
  readonly etiqueta: string
  readonly capacidad: number
  readonly kind: string
  readonly activa: boolean
  readonly zonaId: string | null
  readonly zonaNombre: string | null
  readonly posFila: number | null
  readonly posColumna: number | null
}

export type NuevaMesa = {
  readonly etiqueta: string
  readonly zonaId: string | null
  readonly capacidad: number
  readonly kind: string
}

/** Categoria de la carta. `name_i18n` se lee y se escribe solo en español por ahora. */
export type Categoria = {
  readonly id: string
  readonly nombre: string
  readonly orden: number
  readonly activa: boolean
  readonly disponible: boolean
}

export type EntradaCategoria = {
  readonly nombre: string
}

/** Plato o bebida. La bebida es un plato con `estacion` de barra (D-048). */
export type Plato = {
  readonly id: string
  readonly categoriaId: string | null
  readonly nombre: string
  readonly descripcion: string | null
  readonly precioClp: number
  readonly fotoClave: string | null
  readonly allergens: readonly string[]
  readonly tags: readonly string[]
  readonly estacion: string | null
  readonly disponible: boolean
  readonly desde: string | null
  readonly hasta: string | null
  readonly orden: number
  readonly activo: boolean
}

/** Lo que el formulario manda para crear o editar un plato. */
export type EntradaPlato = Omit<Plato, "id" | "fotoClave">

/** Los dos estados que se alternan sin borrar la ficha: activo (retirar) y disponible (agotar). */
export type CampoDePlato = "activo" | "disponible"

/** Subir o bajar una ficha dentro de su orden. */
export type DireccionOrden = "subir" | "bajar"

export type MotivoDeFallo = "sin_permiso" | "no_existe" | "conflicto"

export type Resultado<T = void> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly motivo: MotivoDeFallo }

/**
 * Por que no se pudo decidir una solicitud de emparejamiento. Se distinguen las causas para que
 * el mensaje deje de ser generico: un cero que no se explica es un cero invisible (LL-024).
 */
export type MotivoDeDecision = "sin_permiso" | "otro_local" | "ya_decidida" | "caducada"

export type ResultadoDecision =
  | { readonly ok: true; readonly valor: undefined }
  | { readonly ok: false; readonly motivo: MotivoDeDecision }

/** Por que no se pudo mover una mesa. Se explica en pantalla, nunca se ignora (D-046). */
export type MotivoDeMovimiento = "sin_permiso" | "no_existe" | "ocupada" | "fuera_de_cuadricula"

export type ResultadoMovimiento =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: MotivoDeMovimiento }

/** Solicitud de emparejamiento pendiente, tal como la ve el personal para decidir. */
export type SolicitudPendiente = {
  readonly id: string
  readonly mesa: string
  readonly pedidaHaceSegundos: number
  readonly restanteSegundos: number
}

/** Una linea de una comanda tal como se ve en la pantalla de un puesto. NUNCA lleva precio. */
export type LineaDeComanda = {
  readonly nombre: string
  readonly cantidad: number
}

/** Una comanda en la pantalla de un puesto: su mesa, su destino, su estado y su antiguedad. */
export type ComandaDePuesto = {
  readonly id: string
  readonly mesa: string
  readonly destino: string
  readonly estado: EstadoDeComanda
  readonly creadaHaceSegundos: number
  readonly lineas: readonly LineaDeComanda[]
}

/** Por que no se pudo cambiar el estado de una comanda. */
export type MotivoDeCambioComanda = "sin_permiso" | "no_existe" | "transicion_invalida"

export type ResultadoCambioComanda =
  | { readonly ok: true; readonly valor: { readonly estado: EstadoDeComanda } }
  | { readonly ok: false; readonly motivo: MotivoDeCambioComanda }

/** Lo que el panel necesita de la base. Se inyecta para poder probar sin tocar Postgres. */
export type AlmacenPanel = {
  readonly leerLocal: (empleado: Empleado) => Promise<DatosLocal | null>
  readonly actualizarLocal: (empleado: Empleado, cambios: CambiosLocal) => Promise<Resultado>
  readonly listarZonas: (empleado: Empleado) => Promise<readonly Zona[]>
  readonly crearZona: (empleado: Empleado, datos: NuevaZona) => Promise<Resultado>
  readonly listarMesas: (empleado: Empleado) => Promise<readonly Mesa[]>
  readonly crearMesa: (empleado: Empleado, datos: NuevaMesa) => Promise<Resultado<Mesa>>
  readonly alternarMesa: (empleado: Empleado, mesaId: string) => Promise<Resultado>
  readonly leerMesa: (empleado: Empleado, mesaId: string) => Promise<Mesa | null>
  readonly moverMesa: (
    empleado: Empleado,
    mesaId: string,
    direccion: Direccion,
  ) => Promise<ResultadoMovimiento>
  readonly acomodarMesasSinPosicion: (empleado: Empleado) => Promise<void>
  readonly listarCategorias: (empleado: Empleado) => Promise<readonly Categoria[]>
  readonly leerCategoria: (empleado: Empleado, categoriaId: string) => Promise<Categoria | null>
  readonly crearCategoria: (
    empleado: Empleado,
    datos: EntradaCategoria,
  ) => Promise<Resultado<Categoria>>
  readonly alternarCategoria: (empleado: Empleado, categoriaId: string) => Promise<Resultado>
  readonly renombrarCategoria: (
    empleado: Empleado,
    categoriaId: string,
    nombre: string,
  ) => Promise<Resultado>
  readonly moverCategoria: (
    empleado: Empleado,
    categoriaId: string,
    direccion: DireccionOrden,
  ) => Promise<Resultado>
  readonly listarPlatos: (
    empleado: Empleado,
    categoriaId: string | null,
  ) => Promise<readonly Plato[]>
  readonly leerPlato: (empleado: Empleado, platoId: string) => Promise<Plato | null>
  readonly crearPlato: (empleado: Empleado, datos: EntradaPlato) => Promise<Resultado<Plato>>
  readonly actualizarPlato: (
    empleado: Empleado,
    platoId: string,
    datos: EntradaPlato,
  ) => Promise<Resultado>
  readonly alternarPlato: (
    empleado: Empleado,
    platoId: string,
    campo: CampoDePlato,
  ) => Promise<Resultado>
  readonly moverPlato: (
    empleado: Empleado,
    platoId: string,
    direccion: DireccionOrden,
  ) => Promise<Resultado>
  readonly fijarFoto: (
    empleado: Empleado,
    platoId: string,
    clave: string | null,
  ) => Promise<Resultado<string | null>>
  readonly contarParejasPendientes: (empleado: Empleado) => Promise<number>
  readonly listarParejasPendientes: (empleado: Empleado) => Promise<readonly SolicitudPendiente[]>
  readonly aprobarPareja: (empleado: Empleado, solicitudId: string) => Promise<ResultadoDecision>
  readonly rechazarPareja: (
    empleado: Empleado,
    solicitudId: string,
    motivo: string,
  ) => Promise<ResultadoDecision>
  readonly listarComandas: (
    empleado: Empleado,
    puesto: PuestoDePantalla,
  ) => Promise<readonly ComandaDePuesto[]>
  readonly cambiarEstadoComanda: (
    empleado: Empleado,
    comandaId: string,
    destino: EstadoDeComanda,
  ) => Promise<ResultadoCambioComanda>
}

type FilaLocal = {
  readonly id: string
  readonly org_id: string
  readonly slug: string
  readonly name: string
  readonly timezone: string
  readonly currency: string
  readonly status: string
  readonly service_mode: string
}

type FilaZona = {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly mesas: number
}

type FilaMesa = {
  readonly id: string
  readonly location_id: string
  readonly code: string
  readonly label: string
  readonly capacity: number
  readonly kind: string
  readonly active: boolean
  readonly zone_id: string | null
  readonly zone_name: string | null
  readonly pos_fila: number | null
  readonly pos_columna: number | null
}

type FilaCategoria = {
  readonly id: string
  readonly name_i18n: Readonly<Record<string, unknown>> | null
  readonly sort_order: number
  readonly active: boolean
  readonly available: boolean
}

type FilaPlato = {
  readonly id: string
  readonly location_id: string
  readonly category_id: string | null
  readonly name_i18n: Readonly<Record<string, unknown>> | null
  readonly description_i18n: Readonly<Record<string, unknown>> | null
  readonly price_clp: number
  readonly photo_r2_key: string | null
  readonly allergens: string[]
  readonly tags: string[]
  readonly prep_station: string | null
  readonly available: boolean
  readonly available_from: string | null
  readonly available_until: string | null
  readonly sort_order: number
  readonly active: boolean
}

const COLUMNAS_LOCAL = "id, org_id, slug, name, timezone, currency, status, service_mode"

const COLUMNAS_CATEGORIA = "id, name_i18n, sort_order, active, available"

const COLUMNAS_PLATO =
  "id, location_id, category_id, name_i18n, description_i18n, price_clp, photo_r2_key, allergens, tags, prep_station, available, available_from, available_until, sort_order, active"

const COLUMNAS_MESA =
  "t.id, t.location_id, t.code, t.label, t.capacity, t.kind, t.active, t.zone_id, t.pos_fila, t.pos_columna, z.name as zone_name"

function aDatosLocal(fila: FilaLocal): DatosLocal {
  return {
    id: fila.id,
    orgId: fila.org_id,
    nombre: fila.name,
    slug: fila.slug,
    timezone: fila.timezone,
    currency: fila.currency,
    status: fila.status,
    serviceMode: fila.service_mode,
  }
}

function aZona(fila: FilaZona): Zona {
  return { id: fila.id, nombre: fila.name, kind: fila.kind, mesas: fila.mesas }
}

function aMesa(fila: FilaMesa): Mesa {
  return {
    id: fila.id,
    codigo: fila.code,
    etiqueta: fila.label,
    capacidad: fila.capacity,
    kind: fila.kind,
    activa: fila.active,
    zonaId: fila.zone_id,
    zonaNombre: fila.zone_name,
    posFila: fila.pos_fila,
    posColumna: fila.pos_columna,
  }
}

/**
 * Saca el texto en español de un campo `*_i18n`. Si no hay español, cae al primer idioma que
 * traiga algo; si esta vacio o mal formado, devuelve null. Nunca inventa un nombre.
 */
function textoEs(valor: Readonly<Record<string, unknown>> | null): string | null {
  if (valor === null) {
    return null
  }
  const es = valor["es"]
  if (typeof es === "string" && es.trim() !== "") {
    return es
  }
  for (const candidato of Object.values(valor)) {
    if (typeof candidato === "string" && candidato.trim() !== "") {
      return candidato
    }
  }
  return null
}

/** Postgres devuelve `time` como `HH:MM:SS`; para el formulario basta `HH:MM`. */
function horaCorta(valor: string | null): string | null {
  return valor === null ? null : valor.slice(0, 5)
}

function aCategoria(fila: FilaCategoria): Categoria {
  return {
    id: fila.id,
    nombre: textoEs(fila.name_i18n) ?? "Sin nombre",
    orden: fila.sort_order,
    activa: fila.active,
    disponible: fila.available,
  }
}

function aPlato(fila: FilaPlato): Plato {
  return {
    id: fila.id,
    categoriaId: fila.category_id,
    nombre: textoEs(fila.name_i18n) ?? "Sin nombre",
    descripcion: textoEs(fila.description_i18n),
    precioClp: fila.price_clp,
    fotoClave: fila.photo_r2_key,
    allergens: fila.allergens,
    tags: fila.tags,
    estacion: fila.prep_station,
    disponible: fila.available,
    desde: horaCorta(fila.available_from),
    hasta: horaCorta(fila.available_until),
    orden: fila.sort_order,
    activo: fila.active,
  }
}

function contextoDe(empleado: Empleado): ContextoDeEmpleado {
  return {
    staffId: empleado.staffId,
    orgId: empleado.organizacion.id,
    rol: empleado.rol,
    locationId: empleado.local?.id ?? null,
  }
}

async function enTransaccion<T>(
  cadena: string,
  empleado: Empleado,
  trabajo: (cliente: Client) => Promise<T>,
): Promise<T> {
  const cliente = new Client({ connectionString: cadena })
  await cliente.connect()
  try {
    await cliente.query("begin")
    await fijarContextoDeEmpleado(cliente, contextoDe(empleado))
    const valor = await trabajo(cliente)
    await cliente.query("commit")
    return valor
  } catch (error) {
    await cliente.query("rollback")
    throw error
  } finally {
    await cliente.end()
  }
}

/**
 * Local actual: el del empleado, y si no tiene, el primero de su organizacion. Si la RLS
 * no le deja ver ninguno (camarero sin local, otra organizacion) no devuelve fila.
 */
async function resolverLocalId(cliente: Client, empleado: Empleado): Promise<string | null> {
  const resultado = await cliente.query<{ id: string }>(
    `select l.id from public.locations l
     where ($1::uuid is null or l.id = $1::uuid)
     order by l.created_at
     limit 1`,
    [empleado.local?.id ?? null],
  )
  return resultado.rows[0]?.id ?? null
}

async function leerFilaLocal(cliente: Client, id: string): Promise<FilaLocal | null> {
  const resultado = await cliente.query<FilaLocal>(
    `select ${COLUMNAS_LOCAL} from public.locations where id = $1`,
    [id],
  )
  return resultado.rows[0] ?? null
}

async function listarFilaZonas(cliente: Client, localId: string): Promise<FilaZona[]> {
  const resultado = await cliente.query<FilaZona>(
    `select z.id, z.name, z.kind, count(t.id)::int as mesas
     from public.zones z
     left join public.tables t on t.zone_id = z.id
     where z.location_id = $1
     group by z.id, z.name, z.kind
     order by z.name`,
    [localId],
  )
  return resultado.rows
}

async function listarFilaMesas(cliente: Client, localId: string): Promise<FilaMesa[]> {
  const resultado = await cliente.query<FilaMesa>(
    `select ${COLUMNAS_MESA}
     from public.tables t
     left join public.zones z on z.id = t.zone_id
     where t.location_id = $1
     order by z.name nulls last, t.label`,
    [localId],
  )
  return resultado.rows
}

async function leerFilaMesa(cliente: Client, mesaId: string): Promise<FilaMesa | null> {
  const resultado = await cliente.query<FilaMesa>(
    `select ${COLUMNAS_MESA}
     from public.tables t
     left join public.zones z on z.id = t.zone_id
     where t.id = $1`,
    [mesaId],
  )
  return resultado.rows[0] ?? null
}

/**
 * Traduce un error de escritura de Postgres a un motivo esperado. `23505` es una restriccion
 * unica y `42501` es la RLS negando la fila. Devuelve null para lo demas: un fallo que no
 * sabemos explicar es un bug y debe subir, no disfrazarse.
 */
function motivoDeErrorDeEscritura(error: unknown): MotivoDeFallo | null {
  if (typeof error !== "object" || error === null) {
    return null
  }
  const codigo = (error as { readonly code?: unknown }).code
  if (codigo === "23505") {
    return "conflicto"
  }
  if (codigo === "42501") {
    return "sin_permiso"
  }
  return null
}

/** Restriccion unica de celda por zona (migracion 0017). */
const RESTRICCION_POSICION = "tables_posicion_unica"

function esConflictoDePosicion(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  const { code, constraint } = error as { readonly code?: unknown; readonly constraint?: unknown }
  return code === "23505" && constraint === RESTRICCION_POSICION
}

/** Celdas ocupadas en una zona (o en el grupo sin zona). Una posicion nula no ocupa celda. */
async function listarCeldasDeZona(
  cliente: Client,
  localId: string,
  zonaId: string | null,
): Promise<Celda[]> {
  const resultado = await cliente.query<{ pos_fila: number; pos_columna: number }>(
    `select pos_fila, pos_columna from public.tables
     where location_id = $1 and zone_id is not distinct from $2 and pos_fila is not null`,
    [localId, zonaId],
  )
  return resultado.rows.map((fila) => ({ posFila: fila.pos_fila, posColumna: fila.pos_columna }))
}

async function celdaOcupada(cliente: Client, fila: FilaMesa, destino: Posicion): Promise<boolean> {
  const resultado = await cliente.query(
    `select 1 from public.tables
     where location_id = $1 and id <> $2 and zone_id is not distinct from $3
       and pos_fila = $4 and pos_columna = $5
     limit 1`,
    [fila.location_id, fila.id, fila.zone_id, destino.fila, destino.columna],
  )
  return (resultado.rowCount ?? 0) > 0
}

async function escribirZona(
  cliente: Client,
  localId: string,
  datos: NuevaZona,
): Promise<Resultado> {
  try {
    await cliente.query(`insert into public.zones (location_id, name, kind) values ($1, $2, $3)`, [
      localId,
      datos.nombre,
      datos.kind,
    ])
    return { ok: true, valor: undefined }
  } catch (error) {
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo }
  }
}

async function insertarMesa(
  cliente: Client,
  localId: string,
  datos: NuevaMesa,
  codigo: string,
  hueco: Posicion,
): Promise<FilaMesa | undefined> {
  const resultado = await cliente.query<FilaMesa>(
    `insert into public.tables (location_id, zone_id, label, code, capacity, kind, pos_fila, pos_columna)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, location_id, code, label, capacity, kind, active, zone_id, pos_fila, pos_columna, null::text as zone_name`,
    [
      localId,
      datos.zonaId,
      datos.etiqueta,
      codigo,
      datos.capacidad,
      datos.kind,
      hueco.fila,
      hueco.columna,
    ],
  )
  return resultado.rows[0]
}

/**
 * Inserta una mesa con un codigo recien generado y la coloca en el primer hueco libre de su
 * zona. Si el codigo o la celda chocan, se reintenta: el `savepoint` es imprescindible porque,
 * tras un choque, la transaccion queda abortada y el siguiente INSERT fallaria con 25P02 sin
 * poder volver atras.
 */
async function escribirMesa(
  cliente: Client,
  localId: string,
  datos: NuevaMesa,
): Promise<Resultado<Mesa>> {
  for (let intento = 0; intento < INTENTOS_CODIGO; intento += 1) {
    const codigo = generarCodigoMesa()
    await cliente.query("savepoint codigo_mesa")
    try {
      const celdas = await listarCeldasDeZona(cliente, localId, datos.zonaId)
      const hueco = primerHuecoLibre(celdas, dimensionesDeMapa(celdas).columnas)
      const fila = await insertarMesa(cliente, localId, datos, codigo, hueco)
      await cliente.query("release savepoint codigo_mesa")
      if (fila === undefined) {
        throw new Error("La inserción de mesa no devolvió fila")
      }
      return { ok: true, valor: aMesa(fila) }
    } catch (error) {
      await cliente.query("rollback to savepoint codigo_mesa")
      if (esConflictoDeCodigo(error) || esConflictoDePosicion(error)) {
        continue
      }
      const motivo = motivoDeErrorDeEscritura(error)
      if (motivo === null) {
        throw error
      }
      return { ok: false, motivo }
    }
  }
  return { ok: false, motivo: "conflicto" }
}

type FilaAcomodo = {
  readonly id: string
  readonly zone_id: string | null
  readonly pos_fila: number | null
  readonly pos_columna: number | null
}

/** Coloca en el primer hueco libre las mesas sin posicion de un mismo grupo (zona o sin zona). */
async function acomodarGrupo(cliente: Client, filas: readonly FilaAcomodo[]): Promise<void> {
  const celdas: Celda[] = filas.map((fila) => ({
    posFila: fila.pos_fila,
    posColumna: fila.pos_columna,
  }))
  for (const fila of filas) {
    if (fila.pos_fila !== null) {
      continue
    }
    const hueco = primerHuecoLibre(celdas, dimensionesDeMapa(celdas).columnas)
    celdas.push({ posFila: hueco.fila, posColumna: hueco.columna })
    await cliente.query(`update public.tables set pos_fila = $2, pos_columna = $3 where id = $1`, [
      fila.id,
      hueco.fila,
      hueco.columna,
    ])
  }
}

async function acomodarSinPosicion(cliente: Client, localId: string): Promise<void> {
  const resultado = await cliente.query<FilaAcomodo>(
    `select id, zone_id, pos_fila, pos_columna from public.tables
     where location_id = $1 order by label`,
    [localId],
  )
  const grupos = new Map<string | null, FilaAcomodo[]>()
  for (const fila of resultado.rows) {
    const grupo = grupos.get(fila.zone_id)
    if (grupo === undefined) {
      grupos.set(fila.zone_id, [fila])
    } else {
      grupo.push(fila)
    }
  }
  for (const filas of grupos.values()) {
    await acomodarGrupo(cliente, filas)
  }
}

async function escribirMovimiento(
  cliente: Client,
  mesaId: string,
  destino: Posicion,
): Promise<ResultadoMovimiento> {
  try {
    const resultado = await cliente.query(
      `update public.tables set pos_fila = $2, pos_columna = $3 where id = $1 returning id`,
      [mesaId, destino.fila, destino.columna],
    )
    return resultado.rowCount === 1 ? { ok: true } : { ok: false, motivo: "sin_permiso" }
  } catch (error) {
    if (esConflictoDePosicion(error)) {
      return { ok: false, motivo: "ocupada" }
    }
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo: motivo === "conflicto" ? "ocupada" : "sin_permiso" }
  }
}

const INTENTOS_CODIGO = 5

// ---------------------------------------------------------------------------
// La carta: categorias, platos y bebidas
// ---------------------------------------------------------------------------

async function listarFilaCategorias(cliente: Client, localId: string): Promise<FilaCategoria[]> {
  const resultado = await cliente.query<FilaCategoria>(
    `select ${COLUMNAS_CATEGORIA} from public.menu_categories
     where location_id = $1
     order by sort_order, created_at, id`,
    [localId],
  )
  return resultado.rows
}

async function leerFilaCategoria(cliente: Client, id: string): Promise<FilaCategoria | null> {
  const resultado = await cliente.query<FilaCategoria>(
    `select ${COLUMNAS_CATEGORIA} from public.menu_categories where id = $1`,
    [id],
  )
  return resultado.rows[0] ?? null
}

async function escribirCategoria(
  cliente: Client,
  localId: string,
  datos: EntradaCategoria,
): Promise<Resultado<Categoria>> {
  try {
    const resultado = await cliente.query<FilaCategoria>(
      `insert into public.menu_categories (location_id, name_i18n, sort_order)
       values ($1, $2::jsonb,
         coalesce((select max(sort_order) + 1 from public.menu_categories where location_id = $1), 0))
       returning ${COLUMNAS_CATEGORIA}`,
      [localId, JSON.stringify({ es: datos.nombre })],
    )
    const fila = resultado.rows[0]
    if (fila === undefined) {
      throw new Error("La inserción de categoría no devolvió fila")
    }
    return { ok: true, valor: aCategoria(fila) }
  } catch (error) {
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo }
  }
}

async function renombrarFilaCategoria(
  cliente: Client,
  id: string,
  nombre: string,
): Promise<Resultado> {
  try {
    const resultado = await cliente.query(
      `update public.menu_categories set name_i18n = $2::jsonb where id = $1 returning id`,
      [id, JSON.stringify({ es: nombre })],
    )
    if (resultado.rowCount === 1) {
      return { ok: true, valor: undefined }
    }
    const visible = await leerFilaCategoria(cliente, id)
    return { ok: false, motivo: visible === null ? "no_existe" : "sin_permiso" }
  } catch (error) {
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo }
  }
}

async function alternarFilaCategoria(cliente: Client, id: string): Promise<Resultado> {
  const resultado = await cliente.query(
    `update public.menu_categories set active = not active where id = $1 returning id`,
    [id],
  )
  if (resultado.rowCount === 1) {
    return { ok: true, valor: undefined }
  }
  const visible = await leerFilaCategoria(cliente, id)
  return { ok: false, motivo: visible === null ? "no_existe" : "sin_permiso" }
}

/** Mueve un id dentro de una lista y devuelve el nuevo orden. Null si el id no esta. */
function moverEnLista(
  ids: readonly string[],
  id: string,
  direccion: DireccionOrden,
): readonly string[] | null {
  const indice = ids.indexOf(id)
  if (indice === -1) {
    return null
  }
  const destino = direccion === "subir" ? indice - 1 : indice + 1
  if (destino < 0 || destino >= ids.length) {
    return ids
  }
  const copia = [...ids]
  const origenId = copia[indice]
  const destinoId = copia[destino]
  if (origenId === undefined || destinoId === undefined) {
    return ids
  }
  copia[indice] = destinoId
  copia[destino] = origenId
  return copia
}

/** Reescribe el orden de una tabla con indices limpios 0..n-1. Evita empates y huecos. */
async function reordenar(
  cliente: Client,
  tabla: "menu_categories" | "menu_items",
  ids: readonly string[],
): Promise<void> {
  for (const [indice, id] of ids.entries()) {
    await cliente.query(`update public.${tabla} set sort_order = $2 where id = $1`, [id, indice])
  }
}

async function moverFilaCategoria(
  cliente: Client,
  localId: string,
  id: string,
  direccion: DireccionOrden,
): Promise<Resultado> {
  const filas = await listarFilaCategorias(cliente, localId)
  const nuevo = moverEnLista(
    filas.map((fila) => fila.id),
    id,
    direccion,
  )
  if (nuevo === null) {
    return { ok: false, motivo: "no_existe" }
  }
  await reordenar(cliente, "menu_categories", nuevo)
  return { ok: true, valor: undefined }
}

async function listarFilaPlatos(
  cliente: Client,
  localId: string,
  categoriaId: string | null,
): Promise<FilaPlato[]> {
  const resultado = await cliente.query<FilaPlato>(
    `select ${COLUMNAS_PLATO} from public.menu_items
     where location_id = $1 and category_id is not distinct from $2
     order by sort_order, created_at, id`,
    [localId, categoriaId],
  )
  return resultado.rows
}

async function leerFilaPlato(cliente: Client, id: string): Promise<FilaPlato | null> {
  const resultado = await cliente.query<FilaPlato>(
    `select ${COLUMNAS_PLATO} from public.menu_items where id = $1`,
    [id],
  )
  return resultado.rows[0] ?? null
}

function parametrosDePlato(datos: EntradaPlato): readonly unknown[] {
  return [
    datos.categoriaId,
    JSON.stringify({ es: datos.nombre }),
    datos.descripcion === null ? null : JSON.stringify({ es: datos.descripcion }),
    datos.precioClp,
    datos.allergens,
    datos.tags,
    datos.estacion,
    datos.disponible,
    datos.desde,
    datos.hasta,
    datos.orden,
    datos.activo,
  ]
}

async function escribirPlato(
  cliente: Client,
  localId: string,
  datos: EntradaPlato,
): Promise<Resultado<Plato>> {
  try {
    const resultado = await cliente.query<FilaPlato>(
      `insert into public.menu_items
        (location_id, category_id, name_i18n, description_i18n, price_clp, allergens, tags,
         prep_station, available, available_from, available_until, sort_order, active)
       values ($1, $2, $3::jsonb, $4::jsonb, $5, $6::text[], $7::text[], $8, $9, $10::time,
               $11::time, $12, $13)
       returning ${COLUMNAS_PLATO}`,
      [localId, ...parametrosDePlato(datos)],
    )
    const fila = resultado.rows[0]
    if (fila === undefined) {
      throw new Error("La inserción de plato no devolvió fila")
    }
    return { ok: true, valor: aPlato(fila) }
  } catch (error) {
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo }
  }
}

async function actualizarFilaPlato(
  cliente: Client,
  id: string,
  datos: EntradaPlato,
): Promise<Resultado> {
  try {
    const resultado = await cliente.query(
      `update public.menu_items set
         category_id = $2, name_i18n = $3::jsonb, description_i18n = $4::jsonb, price_clp = $5,
         allergens = $6::text[], tags = $7::text[], prep_station = $8, available = $9,
         available_from = $10::time, available_until = $11::time, sort_order = $12, active = $13
       where id = $1
       returning id`,
      [id, ...parametrosDePlato(datos)],
    )
    if (resultado.rowCount === 1) {
      return { ok: true, valor: undefined }
    }
    const visible = await leerFilaPlato(cliente, id)
    return { ok: false, motivo: visible === null ? "no_existe" : "sin_permiso" }
  } catch (error) {
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo }
  }
}

const COLUMNA_DEL_CAMPO: Readonly<Record<CampoDePlato, string>> = {
  activo: "active",
  disponible: "available",
}

async function alternarFilaPlato(
  cliente: Client,
  id: string,
  campo: CampoDePlato,
): Promise<Resultado> {
  const columna = COLUMNA_DEL_CAMPO[campo]
  const resultado = await cliente.query(
    `update public.menu_items set ${columna} = not ${columna} where id = $1 returning id`,
    [id],
  )
  if (resultado.rowCount === 1) {
    return { ok: true, valor: undefined }
  }
  const visible = await leerFilaPlato(cliente, id)
  return { ok: false, motivo: visible === null ? "no_existe" : "sin_permiso" }
}

async function moverFilaPlato(
  cliente: Client,
  id: string,
  direccion: DireccionOrden,
): Promise<Resultado> {
  const actual = await leerFilaPlato(cliente, id)
  if (actual === null) {
    return { ok: false, motivo: "no_existe" }
  }
  const filas = await listarFilaPlatos(cliente, actual.location_id, actual.category_id)
  const nuevo = moverEnLista(
    filas.map((fila) => fila.id),
    id,
    direccion,
  )
  if (nuevo === null) {
    return { ok: false, motivo: "no_existe" }
  }
  await reordenar(cliente, "menu_items", nuevo)
  return { ok: true, valor: undefined }
}

async function fijarFilaFoto(
  cliente: Client,
  id: string,
  clave: string | null,
): Promise<Resultado<string | null>> {
  const anterior = await cliente.query<{ photo_r2_key: string | null }>(
    `select photo_r2_key from public.menu_items where id = $1`,
    [id],
  )
  const fila = anterior.rows[0]
  if (fila === undefined) {
    return { ok: false, motivo: "no_existe" }
  }
  const resultado = await cliente.query(
    `update public.menu_items set photo_r2_key = $2 where id = $1 returning id`,
    [id, clave],
  )
  if (resultado.rowCount !== 1) {
    return { ok: false, motivo: "sin_permiso" }
  }
  return { ok: true, valor: fila.photo_r2_key }
}

type FilaPareja = {
  readonly id: string
  readonly mesa: string
  readonly pedida: number
  readonly restante: number
}

/** Solicitudes pendientes y vigentes del local. La RLS ya acota al local del empleado. */
async function listarFilaParejas(cliente: Client): Promise<FilaPareja[]> {
  const resultado = await cliente.query<FilaPareja>(
    `select pr.id, t.label as mesa,
            extract(epoch from (now() - pr.created_at))::int as pedida,
            extract(epoch from (s.pairing_expires_at - now()))::int as restante
       from public.pairing_requests pr
       join public.table_sessions s on s.id = pr.session_id
       join public.tables t on t.id = pr.table_id
      where pr.state = 'pending'
        and (s.pairing_expires_at is null or s.pairing_expires_at > now())
      order by pr.created_at, pr.id`,
  )
  return resultado.rows
}

const CAUSAS_DE_DECISION: Readonly<Record<string, MotivoDeDecision>> = {
  sin_permiso: "sin_permiso",
  otro_local: "otro_local",
  ya_decidida: "ya_decidida",
  caducada: "caducada",
}

/**
 * Decide una solicitud a traves de la puerta unica de la base, que clasifica la causa, activa la
 * sesion al aprobar y deja rastro en la auditoria. La base es la cerradura: si el empleado no
 * alcanza la solicitud, la funcion devuelve `otro_local` y no toca ninguna fila.
 */
async function decidirPareja(
  cliente: Client,
  solicitudId: string,
  decision: "approved" | "rejected",
  motivo: string | null,
): Promise<ResultadoDecision> {
  try {
    const resultado = await cliente.query<{ causa: string }>(
      "select public.camarero_decidir_emparejamiento($1, $2, $3) as causa",
      [solicitudId, decision, motivo],
    )
    const causa = resultado.rows[0]?.causa ?? "otro_local"
    if (causa === "ok") {
      return { ok: true, valor: undefined }
    }
    const motivoConocido = CAUSAS_DE_DECISION[causa]
    if (motivoConocido === undefined) {
      throw new Error(`Causa de decision desconocida: ${causa}`)
    }
    return { ok: false, motivo: motivoConocido }
  } catch (error) {
    // La RLS puede negar la fila con 42501 antes de que la funcion pueda clasificar.
    if (motivoDeErrorDeEscritura(error) === "sin_permiso") {
      return { ok: false, motivo: "sin_permiso" }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// La cocina: comandas del local
// ---------------------------------------------------------------------------

type FilaComanda = {
  readonly id: string
  readonly status: string
  readonly prep_station: string
  readonly creada: number
  readonly mesa: string
}

type FilaComandaItem = {
  readonly order_id: string
  readonly name_snapshot: string
  readonly qty: number
}

/** Estado por defecto si la base trajera un valor fuera del contrato: no se inventa estado. */
function aEstado(valor: string): EstadoDeComanda {
  return esEstadoDeComanda(valor) ? valor : "anulada"
}

/**
 * Las comandas abiertas que ve una pantalla de puesto (la RLS ya acota al alcance del
 * empleado). `todo` no filtra; cocina y barra reciben solo los destinos de su puesto. Nunca
 * se leen importes: quien prepara no cobra.
 */
async function listarFilaComandas(
  cliente: Client,
  puesto: PuestoDePantalla,
): Promise<readonly ComandaDePuesto[]> {
  const destinos = destinosDelPuesto(puesto)
  const comandas = await cliente.query<FilaComanda>(
    `select o.id, o.status, o.prep_station,
            extract(epoch from (now() - o.created_at))::int as creada,
            coalesce(t.label, s.code, 'Mesa') as mesa
       from public.orders o
       left join public.table_sessions s on s.id = o.session_id
       left join public.tables t on t.id = s.table_id
      where o.status <> 'cerrada'
        and ($1::text[] is null or o.prep_station = any($1::text[]))
      order by o.created_at, o.id`,
    [destinos],
  )
  if (comandas.rows.length === 0) {
    return []
  }
  const items = await cliente.query<FilaComandaItem>(
    `select order_id, name_snapshot, qty
       from public.order_items
      where order_id = any($1::uuid[])
      order by created_at, id`,
    [comandas.rows.map((fila) => fila.id)],
  )
  const porComanda = new Map<string, LineaDeComanda[]>()
  for (const item of items.rows) {
    const lista = porComanda.get(item.order_id) ?? []
    lista.push({ nombre: item.name_snapshot, cantidad: item.qty })
    porComanda.set(item.order_id, lista)
  }
  return comandas.rows.map(
    (fila): ComandaDePuesto => ({
      id: fila.id,
      mesa: fila.mesa,
      destino: fila.prep_station,
      estado: aEstado(fila.status),
      creadaHaceSegundos: fila.creada,
      lineas: porComanda.get(fila.id) ?? [],
    }),
  )
}

/**
 * Cambia el estado de una comanda respetando la maquina de estados del contrato. La base es
 * la que cierra los importes al aceptar; aqui solo se valida la transicion y se escribe.
 */
async function cambiarFilaEstadoComanda(
  cliente: Client,
  comandaId: string,
  destino: EstadoDeComanda,
): Promise<ResultadoCambioComanda> {
  const actual = await cliente.query<{ status: string }>(
    "select status from public.orders where id = $1",
    [comandaId],
  )
  const fila = actual.rows[0]
  if (fila === undefined) {
    return { ok: false, motivo: "no_existe" }
  }
  if (!esEstadoDeComanda(fila.status) || !transicionPermitida(fila.status, destino)) {
    return { ok: false, motivo: "transicion_invalida" }
  }
  try {
    const resultado = await cliente.query(
      "update public.orders set status = $2 where id = $1 returning id",
      [comandaId, destino],
    )
    if (resultado.rowCount === 1) {
      return { ok: true, valor: { estado: destino } }
    }
    const visible = await cliente.query("select 1 from public.orders where id = $1", [comandaId])
    return { ok: false, motivo: (visible.rowCount ?? 0) > 0 ? "sin_permiso" : "no_existe" }
  } catch (error) {
    const motivo = motivoDeErrorDeEscritura(error)
    if (motivo === null) {
      throw error
    }
    return { ok: false, motivo: motivo === "sin_permiso" ? "sin_permiso" : "transicion_invalida" }
  }
}

export function almacenDeBase(cadena: string): AlmacenPanel {
  return {
    leerLocal: (empleado): Promise<DatosLocal | null> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        if (id === null) {
          return null
        }
        const fila = await leerFilaLocal(cliente, id)
        return fila === null ? null : aDatosLocal(fila)
      }),
    actualizarLocal: (empleado, cambios): Promise<Resultado> =>
      enTransaccion(cadena, empleado, async (cliente): Promise<Resultado> => {
        const id = await resolverLocalId(cliente, empleado)
        if (id === null) {
          return { ok: false, motivo: "no_existe" }
        }
        const resultado = await cliente.query(
          `update public.locations
           set name = $2, timezone = $3, status = $4, service_mode = $5
           where id = $1
           returning id`,
          [id, cambios.nombre, cambios.timezone, cambios.status, cambios.serviceMode],
        )
        // Cero filas no es "no existe": el local se acaba de leer y existe. Es la politica
        // `locations_update` la que ha impedido el cambio.
        return resultado.rowCount === 1
          ? { ok: true, valor: undefined }
          : { ok: false, motivo: "sin_permiso" }
      }),
    listarZonas: (empleado): Promise<readonly Zona[]> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null ? [] : (await listarFilaZonas(cliente, id)).map(aZona)
      }),
    crearZona: (empleado, datos): Promise<Resultado> =>
      enTransaccion(cadena, empleado, async (cliente): Promise<Resultado> => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null
          ? { ok: false, motivo: "no_existe" }
          : await escribirZona(cliente, id, datos)
      }),
    listarMesas: (empleado): Promise<readonly Mesa[]> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null ? [] : (await listarFilaMesas(cliente, id)).map(aMesa)
      }),
    crearMesa: (empleado, datos): Promise<Resultado<Mesa>> =>
      enTransaccion(cadena, empleado, async (cliente): Promise<Resultado<Mesa>> => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null
          ? { ok: false, motivo: "no_existe" }
          : await escribirMesa(cliente, id, datos)
      }),
    alternarMesa: (empleado, mesaId): Promise<Resultado> =>
      enTransaccion(cadena, empleado, async (cliente): Promise<Resultado> => {
        const resultado = await cliente.query(
          `update public.tables set active = not active where id = $1 returning active`,
          [mesaId],
        )
        if (resultado.rowCount === 1) {
          return { ok: true, valor: undefined }
        }
        const visible = await leerFilaMesa(cliente, mesaId)
        return { ok: false, motivo: visible === null ? "no_existe" : "sin_permiso" }
      }),
    leerMesa: (empleado, mesaId): Promise<Mesa | null> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const fila = await leerFilaMesa(cliente, mesaId)
        return fila === null ? null : aMesa(fila)
      }),
    moverMesa: (empleado, mesaId, direccion): Promise<ResultadoMovimiento> =>
      enTransaccion(cadena, empleado, async (cliente): Promise<ResultadoMovimiento> => {
        const fila = await leerFilaMesa(cliente, mesaId)
        if (fila === null || fila.pos_fila === null || fila.pos_columna === null) {
          return { ok: false, motivo: "no_existe" }
        }
        const destino = desplazar({ fila: fila.pos_fila, columna: fila.pos_columna }, direccion)
        if (destino === null) {
          return { ok: false, motivo: "fuera_de_cuadricula" }
        }
        if (await celdaOcupada(cliente, fila, destino)) {
          return { ok: false, motivo: "ocupada" }
        }
        return await escribirMovimiento(cliente, mesaId, destino)
      }),
    acomodarMesasSinPosicion: (empleado): Promise<void> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        if (id !== null) {
          await acomodarSinPosicion(cliente, id)
        }
      }),
    listarCategorias: (empleado): Promise<readonly Categoria[]> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null ? [] : (await listarFilaCategorias(cliente, id)).map(aCategoria)
      }),
    leerCategoria: (empleado, categoriaId): Promise<Categoria | null> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const fila = await leerFilaCategoria(cliente, categoriaId)
        return fila === null ? null : aCategoria(fila)
      }),
    crearCategoria: (empleado, datos): Promise<Resultado<Categoria>> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null
          ? { ok: false, motivo: "no_existe" }
          : await escribirCategoria(cliente, id, datos)
      }),
    alternarCategoria: (empleado, categoriaId): Promise<Resultado> =>
      enTransaccion(cadena, empleado, (cliente) => alternarFilaCategoria(cliente, categoriaId)),
    renombrarCategoria: (empleado, categoriaId, nombre): Promise<Resultado> =>
      enTransaccion(cadena, empleado, (cliente) =>
        renombrarFilaCategoria(cliente, categoriaId, nombre),
      ),
    moverCategoria: (empleado, categoriaId, direccion): Promise<Resultado> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null
          ? { ok: false, motivo: "no_existe" }
          : await moverFilaCategoria(cliente, id, categoriaId, direccion)
      }),
    listarPlatos: (empleado, categoriaId): Promise<readonly Plato[]> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null ? [] : (await listarFilaPlatos(cliente, id, categoriaId)).map(aPlato)
      }),
    leerPlato: (empleado, platoId): Promise<Plato | null> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const fila = await leerFilaPlato(cliente, platoId)
        return fila === null ? null : aPlato(fila)
      }),
    crearPlato: (empleado, datos): Promise<Resultado<Plato>> =>
      enTransaccion(cadena, empleado, async (cliente) => {
        const id = await resolverLocalId(cliente, empleado)
        return id === null
          ? { ok: false, motivo: "no_existe" }
          : await escribirPlato(cliente, id, datos)
      }),
    actualizarPlato: (empleado, platoId, datos): Promise<Resultado> =>
      enTransaccion(cadena, empleado, (cliente) => actualizarFilaPlato(cliente, platoId, datos)),
    alternarPlato: (empleado, platoId, campo): Promise<Resultado> =>
      enTransaccion(cadena, empleado, (cliente) => alternarFilaPlato(cliente, platoId, campo)),
    moverPlato: (empleado, platoId, direccion): Promise<Resultado> =>
      enTransaccion(cadena, empleado, (cliente) => moverFilaPlato(cliente, platoId, direccion)),
    fijarFoto: (empleado, platoId, clave): Promise<Resultado<string | null>> =>
      enTransaccion(cadena, empleado, (cliente) => fijarFilaFoto(cliente, platoId, clave)),
    contarParejasPendientes: (empleado): Promise<number> =>
      enTransaccion(cadena, empleado, async (cliente) => (await listarFilaParejas(cliente)).length),
    listarParejasPendientes: (empleado): Promise<readonly SolicitudPendiente[]> =>
      enTransaccion(cadena, empleado, async (cliente) =>
        (await listarFilaParejas(cliente)).map((fila) => ({
          id: fila.id,
          mesa: fila.mesa,
          pedidaHaceSegundos: fila.pedida,
          restanteSegundos: fila.restante,
        })),
      ),
    aprobarPareja: (empleado, solicitudId): Promise<ResultadoDecision> =>
      enTransaccion(cadena, empleado, (cliente) =>
        decidirPareja(cliente, solicitudId, "approved", null),
      ),
    rechazarPareja: (empleado, solicitudId, motivo): Promise<ResultadoDecision> =>
      enTransaccion(cadena, empleado, (cliente) =>
        decidirPareja(cliente, solicitudId, "rejected", motivo),
      ),
    listarComandas: (empleado, puesto): Promise<readonly ComandaDePuesto[]> =>
      enTransaccion(cadena, empleado, (cliente) => listarFilaComandas(cliente, puesto)),
    cambiarEstadoComanda: (empleado, comandaId, destino): Promise<ResultadoCambioComanda> =>
      enTransaccion(cadena, empleado, (cliente) =>
        cambiarFilaEstadoComanda(cliente, comandaId, destino),
      ),
  }
}

/** Sin cadena de conexion no hay base: se falla cerrado, sin inventar datos. */
export function almacenNoConfigurado(): AlmacenPanel {
  return {
    leerLocal: async (): Promise<DatosLocal | null> => null,
    actualizarLocal: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    listarZonas: async (): Promise<readonly Zona[]> => [],
    crearZona: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    listarMesas: async (): Promise<readonly Mesa[]> => [],
    crearMesa: async (): Promise<Resultado<Mesa>> => ({ ok: false, motivo: "no_existe" }),
    alternarMesa: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    leerMesa: async (): Promise<Mesa | null> => null,
    moverMesa: async (): Promise<ResultadoMovimiento> => ({ ok: false, motivo: "no_existe" }),
    acomodarMesasSinPosicion: async (): Promise<void> => undefined,
    listarCategorias: async (): Promise<readonly Categoria[]> => [],
    leerCategoria: async (): Promise<Categoria | null> => null,
    crearCategoria: async (): Promise<Resultado<Categoria>> => ({
      ok: false,
      motivo: "no_existe",
    }),
    alternarCategoria: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    renombrarCategoria: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    moverCategoria: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    listarPlatos: async (): Promise<readonly Plato[]> => [],
    leerPlato: async (): Promise<Plato | null> => null,
    crearPlato: async (): Promise<Resultado<Plato>> => ({ ok: false, motivo: "no_existe" }),
    actualizarPlato: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    alternarPlato: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    moverPlato: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
    fijarFoto: async (): Promise<Resultado<string | null>> => ({
      ok: false,
      motivo: "no_existe",
    }),
    contarParejasPendientes: async (): Promise<number> => 0,
    listarParejasPendientes: async (): Promise<readonly SolicitudPendiente[]> => [],
    aprobarPareja: async (): Promise<ResultadoDecision> => ({ ok: false, motivo: "otro_local" }),
    rechazarPareja: async (): Promise<ResultadoDecision> => ({ ok: false, motivo: "otro_local" }),
    listarComandas: async (): Promise<readonly ComandaDePuesto[]> => [],
    cambiarEstadoComanda: async (): Promise<ResultadoCambioComanda> => ({
      ok: false,
      motivo: "no_existe",
    }),
  }
}

export function almacenDeEntorno(entorno: {
  readonly BASE?: { readonly connectionString: string }
}): AlmacenPanel {
  const cadena = entorno.BASE?.connectionString
  if (cadena === undefined || cadena === "") {
    return almacenNoConfigurado()
  }
  return almacenDeBase(cadena)
}
