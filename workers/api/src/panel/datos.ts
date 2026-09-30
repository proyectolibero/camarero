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

export type MotivoDeFallo = "sin_permiso" | "no_existe" | "conflicto"

export type Resultado<T = void> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly motivo: MotivoDeFallo }

/** Lo que el panel necesita de la base. Se inyecta para poder probar sin tocar Postgres. */
export type AlmacenPanel = {
  readonly leerLocal: (empleado: Empleado) => Promise<DatosLocal | null>
  readonly actualizarLocal: (empleado: Empleado, cambios: CambiosLocal) => Promise<Resultado>
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

const COLUMNAS_LOCAL = "id, org_id, slug, name, timezone, currency, status, service_mode"

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
  }
}

/** Sin cadena de conexion no hay base: se falla cerrado, sin inventar datos. */
export function almacenNoConfigurado(): AlmacenPanel {
  return {
    leerLocal: async (): Promise<DatosLocal | null> => null,
    actualizarLocal: async (): Promise<Resultado> => ({ ok: false, motivo: "no_existe" }),
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
