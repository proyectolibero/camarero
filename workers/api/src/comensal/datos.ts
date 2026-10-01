/**
 * Acceso del comensal anonimo a la base, para la pantalla `GET /t/<codigo>`.
 *
 * El borde abre una transaccion CORTA y fija el contexto en el ORDEN que exigen las
 * cerraduras: primero el codigo (para leer la mesa), luego el identificador y la localidad de
 * esa mesa (para abrir la sesion), y por ultimo la sesion (para leer la carta). Equivocarse
 * en el orden no da un error: da cero filas, que es el peor fallo posible (ADR-0031).
 *
 * El identificador de la sesion lo genera el borde y NO se usa `RETURNING` al crearla: un
 * `INSERT ... RETURNING` aplica tambien las politicas de SELECT, y en ese instante la sesion
 * aun no esta en el contexto. Se lee despues, ya con `app.session_id` fijado.
 */
import { Client } from "pg"

export type PlatoDeCarta = {
  readonly id: string
  readonly nombre: string
  readonly descripcion: string | null
  readonly precioClp: number
  readonly fotoClave: string | null
  readonly estacion: string | null
}

export type CategoriaDeCarta = {
  readonly id: string
  readonly nombre: string
  readonly platos: readonly PlatoDeCarta[]
}

export type EstadoEmparejamiento = "sin_pedir" | "esperando" | "aprobado" | "caducado" | "rechazado"

export type CartaDelComensal = {
  readonly local: string
  readonly mesa: string
  readonly estado: EstadoEmparejamiento
  readonly restanteSegundos: number | null
  readonly categorias: readonly CategoriaDeCarta[]
}

export type LecturaComensal =
  | { readonly tipo: "ok"; readonly sesionId: string; readonly carta: CartaDelComensal }
  | { readonly tipo: "codigo_desconocido" }

/** Lo que el borde necesita para la pantalla del comensal. Se inyecta para probar sin base. */
export type AlmacenComensal = {
  readonly abrir: (codigo: string, sesionId: string | null) => Promise<LecturaComensal>
  readonly pedir: (codigo: string, sesionId: string | null) => Promise<LecturaComensal>
}

type FilaMesa = {
  readonly id: string
  readonly label: string
  readonly location_id: string
}

type FilaSesion = {
  readonly id: string
  readonly table_id: string
  readonly state: string
  readonly pairing_expires_at: Date | null
}

type FilaCategoria = {
  readonly id: string
  readonly name_i18n: Readonly<Record<string, unknown>> | null
  readonly sort_order: number
}

type FilaPlato = {
  readonly id: string
  readonly category_id: string | null
  readonly name_i18n: Readonly<Record<string, unknown>> | null
  readonly description_i18n: Readonly<Record<string, unknown>> | null
  readonly price_clp: number
  readonly photo_r2_key: string | null
  readonly prep_station: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS_CERRADOS = new Set(["closed", "voided"])

async function fijar(
  cliente: Client,
  pares: ReadonlyArray<readonly [string, string]>,
): Promise<void> {
  for (const [clave, valor] of pares) {
    await cliente.query("select set_config($1::text, $2::text, true)", [clave, valor])
  }
}

async function leerMesa(cliente: Client, codigo: string): Promise<FilaMesa | null> {
  const resultado = await cliente.query<FilaMesa>(
    "select id, label, location_id from public.tables where code = $1 limit 1",
    [codigo],
  )
  return resultado.rows[0] ?? null
}

async function leerSesion(cliente: Client, id: string): Promise<FilaSesion | null> {
  const resultado = await cliente.query<FilaSesion>(
    "select id, table_id, state, pairing_expires_at from public.table_sessions where id = $1",
    [id],
  )
  return resultado.rows[0] ?? null
}

/** La sesion de la cookie, si existe, es de esta mesa y no esta cerrada. */
async function sesionDeLaCookie(
  cliente: Client,
  cookie: string | null,
  mesaId: string,
): Promise<FilaSesion | null> {
  if (cookie === null || !UUID.test(cookie)) {
    return null
  }
  await fijar(cliente, [["app.session_id", cookie]])
  const fila = await leerSesion(cliente, cookie)
  if (fila === null || fila.table_id !== mesaId || ESTADOS_CERRADOS.has(fila.state)) {
    return null
  }
  return fila
}

/** El local tiene que estar en servicio: uno en montaje o en pausa no abre mesas (ADR-0032). */
async function localActivo(cliente: Client, locationId: string): Promise<boolean> {
  const resultado = await cliente.query<{ status: string }>(
    "select status from public.locations where id = $1",
    [locationId],
  )
  return resultado.rows[0]?.status === "active"
}

/**
 * Crea la sesion de la mesa del contexto. La ventana arranca al PEDIR, no al escanear: al abrir
 * la pantalla la sesion nace sin ventana (`pairing_expires_at` nula) y solo pedir la fija.
 */
async function crearSesion(
  cliente: Client,
  mesa: FilaMesa,
  conVentana: boolean,
): Promise<FilaSesion> {
  // La cerradura de insercion exige que aun no haya sesion en el contexto.
  await fijar(cliente, [["app.session_id", ""]])
  const id = crypto.randomUUID()
  if (conVentana) {
    await cliente.query(
      `insert into public.table_sessions (id, location_id, table_id, code, state, pairing_expires_at)
       values ($1, $2, $3, $4, 'pairing', now() + public.camarero_ventana_de_emparejamiento())`,
      [id, mesa.location_id, mesa.id, mesa.label],
    )
  } else {
    await cliente.query(
      `insert into public.table_sessions (id, location_id, table_id, code, state)
       values ($1, $2, $3, $4, 'pairing')`,
      [id, mesa.location_id, mesa.id, mesa.label],
    )
  }
  await fijar(cliente, [["app.session_id", id]])
  const fila = await leerSesion(cliente, id)
  if (fila === null) {
    throw new Error("La sesion recien creada no es legible")
  }
  return fila
}

/** Volver a pedir renueva la ventana de la propia sesion: diez minutos mas desde ahora. */
async function renovarVentana(cliente: Client, sesionId: string): Promise<void> {
  await cliente.query(
    `update public.table_sessions
        set pairing_expires_at = now() + public.camarero_ventana_de_emparejamiento()
      where id = $1`,
    [sesionId],
  )
}

/**
 * La solicitud nace pendiente solo si no hay ya una viva. Si la ultima quedo rechazada o
 * caducada se crea una nueva; si sigue pendiente, basta con haber renovado la ventana.
 */
async function registrarSolicitud(
  cliente: Client,
  mesa: FilaMesa,
  sesion: FilaSesion,
): Promise<void> {
  if (sesion.state === "active") {
    return
  }
  const ultima = await cliente.query<{ state: string }>(
    `select state from public.pairing_requests
      where session_id = $1 order by created_at desc, id desc limit 1`,
    [sesion.id],
  )
  if (ultima.rows[0]?.state === "pending") {
    return
  }
  await cliente.query(
    "insert into public.pairing_requests (session_id, table_id, state) values ($1, $2, 'pending')",
    [sesion.id, mesa.id],
  )
}

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

function calcularEstado(
  sesion: FilaSesion,
  ultimaSolicitud: string | null,
): { readonly estado: EstadoEmparejamiento; readonly restante: number | null } {
  const ahora = Date.now()
  if (sesion.state === "active") {
    return { estado: "aprobado", restante: null }
  }
  const expira = sesion.pairing_expires_at
  const restante =
    expira === null ? null : Math.max(0, Math.round((expira.getTime() - ahora) / 1000))
  const vigente = expira === null || expira.getTime() > ahora
  if (ultimaSolicitud === "pending") {
    return vigente ? { estado: "esperando", restante } : { estado: "caducado", restante: null }
  }
  if (ultimaSolicitud === "rejected") {
    return { estado: "rechazado", restante: null }
  }
  return vigente ? { estado: "sin_pedir", restante } : { estado: "caducado", restante: null }
}

function agrupar(
  categorias: readonly FilaCategoria[],
  platos: readonly FilaPlato[],
): readonly CategoriaDeCarta[] {
  const grupos = categorias.map((categoria) => ({
    id: categoria.id,
    nombre: textoEs(categoria.name_i18n) ?? "Carta",
    platos: [] as PlatoDeCarta[],
  }))
  const porId = new Map(grupos.map((grupo) => [grupo.id, grupo]))
  const sueltos: PlatoDeCarta[] = []
  for (const plato of platos) {
    const ficha: PlatoDeCarta = {
      id: plato.id,
      nombre: textoEs(plato.name_i18n) ?? "Plato",
      descripcion: textoEs(plato.description_i18n),
      precioClp: plato.price_clp,
      fotoClave: plato.photo_r2_key,
      estacion: plato.prep_station,
    }
    const grupo = plato.category_id === null ? undefined : porId.get(plato.category_id)
    if (grupo === undefined) {
      sueltos.push(ficha)
    } else {
      grupo.platos.push(ficha)
    }
  }
  if (sueltos.length > 0) {
    grupos.push({ id: "", nombre: "Sin categoría", platos: sueltos })
  }
  return grupos.filter((grupo) => grupo.platos.length > 0)
}

async function cargarCarta(
  cliente: Client,
  mesa: FilaMesa,
  sesion: FilaSesion,
): Promise<CartaDelComensal> {
  const local = await cliente.query<{ name: string }>(
    "select name from public.locations where id = $1",
    [mesa.location_id],
  )
  const ultima = await cliente.query<{ state: string }>(
    "select state from public.pairing_requests where session_id = $1 order by created_at desc, id desc limit 1",
    [sesion.id],
  )
  const categorias = await cliente.query<FilaCategoria>(
    `select id, name_i18n, sort_order from public.menu_categories
     where location_id = $1 and active and available order by sort_order, created_at, id`,
    [mesa.location_id],
  )
  const platos = await cliente.query<FilaPlato>(
    `select id, category_id, name_i18n, description_i18n, price_clp, photo_r2_key, prep_station
     from public.menu_items
     where location_id = $1 and active and available order by sort_order, created_at, id`,
    [mesa.location_id],
  )
  const { estado, restante } = calcularEstado(sesion, ultima.rows[0]?.state ?? null)
  return {
    local: local.rows[0]?.name ?? "Tu local",
    mesa: mesa.label,
    estado,
    restanteSegundos: restante,
    categorias: agrupar(categorias.rows, platos.rows),
  }
}

async function enTransaccion(
  cadena: string,
  pedir: boolean,
  codigo: string,
  cookie: string | null,
) {
  const cliente = new Client({ connectionString: cadena })
  await cliente.connect()
  try {
    await cliente.query("begin")
    // 1. El codigo primero: es lo unico que deja ver la mesa (cerradura 1).
    await fijar(cliente, [
      ["app.table_code", codigo],
      ["app.table_id", ""],
      ["app.role", ""],
      ["app.session_id", ""],
      ["app.location_id", ""],
    ])
    const mesa = await leerMesa(cliente, codigo)
    if (mesa === null) {
      await cliente.query("rollback")
      return { tipo: "codigo_desconocido" } as const
    }
    // 2. La mesa resuelta y su local: la sesion se creara o se reusara sobre ellas.
    await fijar(cliente, [
      ["app.table_id", mesa.id],
      ["app.location_id", mesa.location_id],
    ])
    let sesion = await sesionDeLaCookie(cliente, cookie, mesa.id)
    if (sesion === null) {
      // Sin sesion previa solo se abre si el local esta en servicio. El contexto se limpia
      // antes de leer el local: la politica de contexto exige que aun no haya sesion.
      await fijar(cliente, [["app.session_id", ""]])
      if (!(await localActivo(cliente, mesa.location_id))) {
        await cliente.query("rollback")
        return { tipo: "codigo_desconocido" } as const
      }
      sesion = await crearSesion(cliente, mesa, pedir)
    } else if (pedir && sesion.state !== "active") {
      await renovarVentana(cliente, sesion.id)
    }
    if (pedir) {
      await registrarSolicitud(cliente, mesa, sesion)
      // La ventana renovada tiene que verse en la carta: se relee la sesion ya actualizada.
      const actualizada = await leerSesion(cliente, sesion.id)
      if (actualizada !== null) {
        sesion = actualizada
      }
    }
    // 3. La carta se lee con la sesion ya en el contexto.
    const carta = await cargarCarta(cliente, mesa, sesion)
    await cliente.query("commit")
    return { tipo: "ok", sesionId: sesion.id, carta } as const
  } catch (error) {
    await cliente.query("rollback")
    throw error
  } finally {
    await cliente.end()
  }
}

export function almacenComensalDeBase(cadena: string): AlmacenComensal {
  return {
    abrir: (codigo, sesionId) => enTransaccion(cadena, false, codigo, sesionId),
    pedir: (codigo, sesionId) => enTransaccion(cadena, true, codigo, sesionId),
  }
}

/** Sin base no se resuelve nada: se falla cerrado, nunca se inventa una carta. */
export function almacenComensalNoConfigurado(): AlmacenComensal {
  const desconocido = async (): Promise<LecturaComensal> => ({ tipo: "codigo_desconocido" })
  return { abrir: desconocido, pedir: desconocido }
}

export function comensalDeEntorno(entorno: {
  readonly BASE?: { readonly connectionString: string }
}): AlmacenComensal {
  const cadena = entorno.BASE?.connectionString
  return cadena === undefined || cadena === ""
    ? almacenComensalNoConfigurado()
    : almacenComensalDeBase(cadena)
}
