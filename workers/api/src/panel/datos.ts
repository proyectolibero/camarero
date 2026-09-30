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
import { Client } from "pg"
import { type ContextoDeEmpleado, type Empleado, fijarContextoDeEmpleado } from "../base.ts"
import { esConflictoDeCodigo, generarCodigoMesa } from "./codigo-mesa.ts"

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
}

export type NuevaMesa = {
  readonly etiqueta: string
  readonly zonaId: string | null
  readonly capacidad: number
  readonly kind: string
}

export type MotivoDeFallo = "sin_permiso" | "no_existe" | "conflicto"

export type Resultado<T = void> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly motivo: MotivoDeFallo }

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
  readonly code: string
  readonly label: string
  readonly capacity: number
  readonly kind: string
  readonly active: boolean
  readonly zone_id: string | null
  readonly zone_name: string | null
}

const COLUMNAS_LOCAL = "id, org_id, slug, name, timezone, currency, status, service_mode"

const COLUMNAS_MESA =
  "t.id, t.code, t.label, t.capacity, t.kind, t.active, t.zone_id, z.name as zone_name"

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

/**
 * Inserta una mesa con un codigo recien generado. Si el codigo choca con el de otra mesa del
 * local, se reintenta. El `savepoint` es imprescindible: tras un choque, la transaccion queda
 * abortada y el siguiente INSERT fallaria con 25P02 sin poder volver atras.
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
      const resultado = await cliente.query<FilaMesa>(
        `insert into public.tables (location_id, zone_id, label, code, capacity, kind)
         values ($1, $2, $3, $4, $5, $6)
         returning id, code, label, capacity, kind, active, zone_id, null::text as zone_name`,
        [localId, datos.zonaId, datos.etiqueta, codigo, datos.capacidad, datos.kind],
      )
      await cliente.query("release savepoint codigo_mesa")
      const fila = resultado.rows[0]
      if (fila === undefined) {
        throw new Error("La inserción de mesa no devolvió fila")
      }
      return { ok: true, valor: aMesa(fila) }
    } catch (error) {
      await cliente.query("rollback to savepoint codigo_mesa")
      if (esConflictoDeCodigo(error)) {
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

const INTENTOS_CODIGO = 5

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
