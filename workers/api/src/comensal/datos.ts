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
import { totalDeLineas } from "@camarero/domain"
import { Client } from "pg"
import type { LineaDeEnvio } from "./cesta.ts"

export type PlatoDeCarta = {
  readonly id: string
  readonly nombre: string
  readonly descripcion: string | null
  readonly precioClp: number
  readonly fotoClave: string | null
  readonly puestoId: string | null
  readonly puestoNombre: string | null
  readonly autoAcepta: boolean
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
  /**
   * Lo que el comensal lleva pedido en la mesa. Viaja con la carta para que la franja del
   * gasto (D-056) lo muestre en la carta y en la cesta, no solo en la pantalla de pedidos.
   */
  readonly subtotalAcumuladoClp: number
  /** Ya ha pedido la cuenta: se le dice y deja de poder pedir platos. */
  readonly cuentaPedida: boolean
  readonly categorias: readonly CategoriaDeCarta[]
}

export type LecturaComensal =
  | { readonly tipo: "ok"; readonly sesionId: string; readonly carta: CartaDelComensal }
  | { readonly tipo: "codigo_desconocido" }
  | { readonly tipo: "local_inactivo" }
  | { readonly tipo: "sesion_cerrada" }

/**
 * Resultado del envio de la cesta. Cada causa se distingue para que la pantalla pueda decir
 * que paso: un cero sin explicar es un cero invisible (LL-024).
 */
export type ResultadoEnvio =
  | { readonly tipo: "ok"; readonly pedidoId: string }
  | { readonly tipo: "codigo_desconocido" }
  | { readonly tipo: "sin_sesion" }
  | { readonly tipo: "sin_aprobar" }
  | { readonly tipo: "cesta_vacia" }
  | { readonly tipo: "cuenta_pedida" }

/** Resultado de pedir la cuenta. Cada causa se distingue para poder decir que paso. */
export type ResultadoCuenta =
  | { readonly tipo: "ok" }
  | { readonly tipo: "codigo_desconocido" }
  | { readonly tipo: "sin_sesion" }
  | { readonly tipo: "sin_aprobar" }

/** Una linea tal como la ve el comensal en el estado de sus pedidos. */
export type LineaDelPedido = {
  readonly nombre: string
  readonly cantidad: number
  readonly totalClp: number
}

/** Una comanda del comensal, con su destino, sus lineas y el total real de la carta. */
export type PedidoDelComensal = {
  readonly id: string
  readonly destino: string
  readonly estado: string
  readonly creadoHaceSegundos: number
  readonly lineas: readonly LineaDelPedido[]
  readonly totalClp: number
}

export type LecturaPedidos =
  | {
      readonly tipo: "ok"
      readonly local: string
      readonly mesa: string
      readonly pedidos: readonly PedidoDelComensal[]
      /** Suma de las comandas NO anuladas: lo que el comensal lleva pedido en la mesa. */
      readonly subtotalAcumuladoClp: number
      /** Ya ha pedido la cuenta: se le dice y deja de poder pedir platos. */
      readonly cuentaPedida: boolean
    }
  | { readonly tipo: "codigo_desconocido" }
  | { readonly tipo: "sin_sesion" }

/** Lo que el borde necesita para la pantalla del comensal. Se inyecta para probar sin base. */
export type AlmacenComensal = {
  readonly abrir: (codigo: string, sesionId: string | null) => Promise<LecturaComensal>
  readonly pedir: (codigo: string, sesionId: string | null) => Promise<LecturaComensal>
  readonly enviar: (
    codigo: string,
    sesionId: string | null,
    clave: string,
    lineas: readonly LineaDeEnvio[],
  ) => Promise<ResultadoEnvio>
  readonly pedidos: (codigo: string, sesionId: string | null) => Promise<LecturaPedidos>
  readonly pedirCuenta: (codigo: string, sesionId: string | null) => Promise<ResultadoCuenta>
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
  readonly prep_station_id: string | null
  readonly prep_station_name: string | null
  readonly auto_accept: boolean
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

/** La sesion de la cookie, si existe y es de esta mesa. Distingue "no hay" de "esta cerrada". */
type SesionLeida =
  | { readonly tipo: "ok"; readonly sesion: FilaSesion }
  | { readonly tipo: "ninguna" }
  | { readonly tipo: "cerrada" }

/**
 * La sesion de la cookie, si existe y es de esta mesa. Una sesion cerrada NO vale: el
 * identificador deja de ser la credencial del comensal. Se distingue de "no hay cookie" para
 * poder decir la verdad en pantalla en lugar de abrir en silencio una sesion nueva.
 */
async function sesionDeLaCookie(
  cliente: Client,
  cookie: string | null,
  mesaId: string,
): Promise<SesionLeida> {
  if (cookie === null || !UUID.test(cookie)) {
    return { tipo: "ninguna" }
  }
  await fijar(cliente, [["app.session_id", cookie]])
  const fila = await leerSesion(cliente, cookie)
  if (fila === null || fila.table_id !== mesaId) {
    return { tipo: "ninguna" }
  }
  if (ESTADOS_CERRADOS.has(fila.state)) {
    return { tipo: "cerrada" }
  }
  return { tipo: "ok", sesion: fila }
}

/**
 * Marca actividad en la sesion. Es la señal real del cierre por inactividad: `last_seen` de
 * `table_devices` existia en el esquema pero nadie lo escribia, porque el comensal no crea
 * dispositivos (la sesion es un token al portador). Se toca en cada interaccion con la sesion.
 */
async function tocarActividad(cliente: Client, sesionId: string): Promise<void> {
  await cliente.query("update public.table_sessions set last_activity_at = now() where id = $1", [
    sesionId,
  ])
}

/**
 * Verdadero si la sesion tiene una cuenta viva (pedida y no terminada). Mientras la tenga, el
 * comensal no puede pedir platos: la barrera de la BASE (`puede_crear_orden`) usa esta misma
 * condicion, de modo que forzar el POST tampoco sirve.
 */
async function hayCuentaViva(cliente: Client, sesionId: string): Promise<boolean> {
  const resultado = await cliente.query(
    `select 1 from public.bill_requests
      where session_id = $1 and state in ('requested', 'preparing', 'ready')
      limit 1`,
    [sesionId],
  )
  return (resultado.rowCount ?? 0) > 0
}

/**
 * Solo un local en servicio abre mesas: `draft` (montaje) y `paused` (cerrado temporalmente)
 * no lo hacen (ADR-0032). Es una decision del LOCAL, no del codigo: por eso se distingue de
 * «codigo desconocido» y la pantalla no puede hablar de un QR invalido (LL-024).
 */
export function localEnServicio(status: string): boolean {
  return status === "active"
}

/** El local tiene que estar en servicio: uno en montaje o en pausa no abre mesas (ADR-0032). */
async function localActivo(cliente: Client, locationId: string): Promise<boolean> {
  const resultado = await cliente.query<{ status: string }>(
    "select status from public.locations where id = $1",
    [locationId],
  )
  return localEnServicio(resultado.rows[0]?.status ?? "")
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
  const es = valor.es
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
      puestoId: plato.prep_station_id,
      puestoNombre: plato.prep_station_name,
      autoAcepta: plato.auto_accept,
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
  // El puesto del plato se resuelve aqui mismo, en UNA consulta para toda la carta. La base
  // tiene la funcion `camarero_estacion_de_plato`, que es la fuente de verdad de la regla
  // (plato -> categoria -> defecto del local), pero resolver N platos con ella serian N
  // consultas y no devuelve el nombre ni el auto-aceptado que la cesta necesita. Se repite la
  // MISMA regla con un `coalesce`; sigue sin haber una tercera copia en TypeScript: la que
  // habia en `@camarero/domain` (`puestoDePlato`) se elimino por codigo muerto (H4).
  const platos = await cliente.query<FilaPlato>(
    `select mi.id, mi.category_id, mi.name_i18n, mi.description_i18n, mi.price_clp,
            mi.photo_r2_key,
            coalesce(mi.prep_station_id, mc.prep_station_id, d.id) as prep_station_id,
            coalesce(mks.name, cks.name, d.name) as prep_station_name,
            coalesce(mks.auto_accept, cks.auto_accept, d.auto_accept, false) as auto_accept
       from public.menu_items mi
       left join public.menu_categories mc on mc.id = mi.category_id
       left join public.kitchen_stations mks on mks.id = mi.prep_station_id
       left join public.kitchen_stations cks on cks.id = mc.prep_station_id
       left join lateral (
         select ks.id, ks.name, ks.auto_accept
           from public.kitchen_stations ks
          where ks.location_id = mi.location_id and ks.is_default
          limit 1
       ) d on true
      where mi.location_id = $1 and mi.active and mi.available
      order by mi.sort_order, mi.created_at, mi.id`,
    [mesa.location_id],
  )
  const { estado, restante } = calcularEstado(sesion, ultima.rows[0]?.state ?? null)
  // El gasto acumulado sale de las MISMAS comandas y con la MISMA funcion de totales que la
  // pantalla de pedidos (D-056): no hay un segundo calculo que pueda separarse del primero.
  const pedidos = await cargarPedidos(cliente, sesion.id)
  return {
    local: local.rows[0]?.name ?? "Tu local",
    mesa: mesa.label,
    estado,
    restanteSegundos: restante,
    subtotalAcumuladoClp: subtotalDePedidos(pedidos),
    cuentaPedida: await hayCuentaViva(cliente, sesion.id),
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
    const leida = await sesionDeLaCookie(cliente, cookie, mesa.id)
    if (leida.tipo === "cerrada") {
      // El identificador de una sesion cerrada deja de valer: no se abre una nueva a sus
      // espaldas ni se muestra la carta.
      await cliente.query("rollback")
      return { tipo: "sesion_cerrada" } as const
    }
    let sesion: FilaSesion | null = leida.tipo === "ok" ? leida.sesion : null
    if (sesion === null) {
      // Sin sesion previa solo se abre si el local esta en servicio. El contexto se limpia
      // antes de leer el local: la politica de contexto exige que aun no haya sesion.
      await fijar(cliente, [["app.session_id", ""]])
      if (!(await localActivo(cliente, mesa.location_id))) {
        await cliente.query("rollback")
        return { tipo: "local_inactivo" } as const
      }
      sesion = await crearSesion(cliente, mesa, pedir)
    } else if (pedir && sesion.state !== "active") {
      await renovarVentana(cliente, sesion.id)
    }
    // Toda interaccion con la sesion es actividad: alimenta el cierre por inactividad (4 h).
    await tocarActividad(cliente, sesion.id)
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

// ---------------------------------------------------------------------------
// Envio de la comanda y estado de los pedidos
// ---------------------------------------------------------------------------

type SesionValidada = {
  readonly mesa: FilaMesa
  readonly sesion: FilaSesion
  readonly orgId: string
}

type Envoltorio<T> = { readonly fallo: "codigo_desconocido" | "sin_sesion" } | { readonly valor: T }

/**
 * Abre una transaccion del comensal y le deja el contexto fijado. Devuelve el fallo de
 * contexto (codigo inexistente o sin sesion) sin llamar al trabajo; si la sesion existe, el
 * trabajo decide. Reutiliza la MISMA cerradura que `abrir`: primero el codigo, luego la mesa y
 * la localidad, por ultimo la sesion.
 */
async function comoComensal<T>(
  cadena: string,
  codigo: string,
  sesionId: string | null,
  trabajo: (cliente: Client, datos: SesionValidada) => Promise<T>,
): Promise<Envoltorio<T>> {
  const cliente = new Client({ connectionString: cadena })
  await cliente.connect()
  try {
    await cliente.query("begin")
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
      return { fallo: "codigo_desconocido" }
    }
    await fijar(cliente, [
      ["app.table_id", mesa.id],
      ["app.location_id", mesa.location_id],
    ])
    const leida = await sesionDeLaCookie(cliente, sesionId, mesa.id)
    if (leida.tipo !== "ok") {
      // Sin cookie util o con una sesion cerrada: el identificador no vale para pedir.
      await cliente.query("rollback")
      return { fallo: "sin_sesion" }
    }
    const sesion = leida.sesion
    await tocarActividad(cliente, sesion.id)
    const org = await cliente.query<{ org_id: string }>(
      "select org_id from public.table_sessions where id = $1",
      [sesion.id],
    )
    const valor = await trabajo(cliente, { mesa, sesion, orgId: org.rows[0]?.org_id ?? "" })
    await cliente.query("commit")
    return { valor }
  } catch (error) {
    await cliente.query("rollback")
    throw error
  } finally {
    await cliente.end()
  }
}

function esConflictoDeIdempotencia(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  return (error as { readonly code?: unknown }).code === "23505"
}

/** La comanda ya creada con esta clave, si existe y es de esta sesion. */
async function leerPedidoPorClave(
  cliente: Client,
  clave: string,
  sesionId: string,
): Promise<string | null> {
  const resultado = await cliente.query<{ id: string }>(
    "select id from public.orders where idempotency_key = $1 and session_id = $2",
    [clave, sesionId],
  )
  return resultado.rows[0]?.id ?? null
}

/**
 * Una comanda a crear: el puesto real, su nombre congelado, si nace aceptada y las lineas que
 * van a el. `clave` es el identificador estable del puesto para derivar la idempotencia.
 */
type GrupoDeEnvio = {
  readonly clave: string
  readonly puestoId: string | null
  readonly puestoNombre: string | null
  readonly autoAcepta: boolean
  readonly lineas: readonly LineaDeEnvio[]
}

type AcumuladorDeEnvio = {
  readonly clave: string
  readonly puestoId: string | null
  readonly puestoNombre: string | null
  readonly autoAcepta: boolean
  readonly lineas: LineaDeEnvio[]
}

/**
 * Reparte el envio por el puesto REAL del plato (plato -> categoria -> defecto del local, ya
 * resuelto en la carta). Una cesta con una parrilla y una bebida produce dos comandas que
 * avanzan por separado (ADR-0033). Un plato sin puesto por ningun lado va al defecto del local.
 */
function agruparPorDestino(lineas: readonly LineaDeEnvio[]): readonly GrupoDeEnvio[] {
  const grupos = new Map<string, AcumuladorDeEnvio>()
  for (const linea of lineas) {
    const clave = linea.puestoId ?? "sin-puesto"
    const existente = grupos.get(clave)
    if (existente !== undefined) {
      existente.lineas.push(linea)
      continue
    }
    grupos.set(clave, {
      clave,
      puestoId: linea.puestoId,
      puestoNombre: linea.puestoNombre,
      autoAcepta: linea.autoAcepta,
      lineas: [linea],
    })
  }
  return [...grupos.values()]
}

/**
 * Clave de idempotencia de una comanda hermana. La clave del envio se comparte entre puestos,
 * pero `orders.idempotency_key` es unica en TODO el sistema: se deriva una clave por puesto
 * para que dos comandas hermanas de la misma mesa no choquen. Reenviar el mismo envio
 * reproduce las mismas claves y no crea comandas nuevas.
 */
function claveDeDestino(clave: string, puesto: string): string {
  return `${clave}.${puesto}`
}

/** Crea la comanda de un puesto con sus lineas; si ya existe, la devuelve sin crear otra. */
async function crearComandaDeDestino(
  cliente: Client,
  datos: SesionValidada,
  clave: string,
  grupo: GrupoDeEnvio,
): Promise<string> {
  const claveDestino = claveDeDestino(clave, grupo.clave)
  const existente = await leerPedidoPorClave(cliente, claveDestino, datos.sesion.id)
  if (existente !== null) {
    return existente
  }
  await cliente.query(
    `insert into public.orders
       (org_id, location_id, session_id, source, client_alias, prep_station, prep_station_id,
        idempotency_key)
     values ($1, $2, $3, 'table', $4, $5, $6::uuid, $7)`,
    [
      datos.orgId,
      datos.mesa.location_id,
      datos.sesion.id,
      datos.mesa.label,
      grupo.puestoNombre ?? "Sin puesto",
      grupo.puestoId,
      claveDestino,
    ],
  )
  const pedidoId = await leerPedidoPorClave(cliente, claveDestino, datos.sesion.id)
  if (pedidoId === null) {
    throw new Error("La comanda recien creada no es legible")
  }
  for (const linea of grupo.lineas) {
    await cliente.query(
      `insert into public.order_items (order_id, menu_item_id, qty) values ($1, $2, $3)`,
      [pedidoId, linea.platoId, linea.cantidad],
    )
  }
  if (grupo.autoAcepta) {
    // Un puesto auto-aceptado nace aceptado: el disparador de cierre calcula los importes.
    await cliente.query(`update public.orders set status = 'aceptada' where id = $1`, [pedidoId])
  }
  return pedidoId
}

/**
 * Lo que el comensal lleva pedido en la mesa: la suma de sus comandas vivas, sin las
 * anuladas. Usa la MISMA funcion de totales del dominio que el total de cada comanda
 * (CONTRACT-dinero): aqui no se vuelve a multiplicar ni a redondear.
 */
export function subtotalDePedidos(pedidos: readonly PedidoDelComensal[]): number {
  return totalDeLineas(pedidos.filter((pedido) => pedido.estado !== "anulada"))
}

/**
 * Tras una carrera de idempotencia, recupera la primera comanda hermana ya creada. Otra
 * peticion identica gano el INSERT; se devuelve lo suyo en lugar de un error.
 */
async function recuperarEnvio(
  cadena: string,
  codigo: string,
  sesionId: string | null,
  clave: string,
  grupos: readonly GrupoDeEnvio[],
): Promise<ResultadoEnvio | null> {
  const envuelto = await comoComensal(cadena, codigo, sesionId, async (cliente, datos) => {
    for (const grupo of grupos) {
      const id = await leerPedidoPorClave(
        cliente,
        claveDeDestino(clave, grupo.clave),
        datos.sesion.id,
      )
      if (id !== null) {
        return id
      }
    }
    return null
  })
  if ("fallo" in envuelto || envuelto.valor === null) {
    return null
  }
  return { tipo: "ok", pedidoId: envuelto.valor }
}

/**
 * Envio de la comanda. La base fija el precio, el destino y el estado. Una cesta se parte en
 * una comanda por destino; cada una se crea con su propia clave de idempotencia derivada, de
 * modo que un doble toque o un reintento de red no crea comandas nuevas.
 */
async function enviarComanda(
  cadena: string,
  codigo: string,
  sesionId: string | null,
  clave: string,
  lineas: readonly LineaDeEnvio[],
): Promise<ResultadoEnvio> {
  if (lineas.length === 0 || clave === "") {
    return { tipo: "cesta_vacia" }
  }
  const grupos = agruparPorDestino(lineas)
  const envuelto = await comoComensal(cadena, codigo, sesionId, async (cliente, datos) => {
    if (datos.sesion.state !== "active") {
      return { tipo: "sin_aprobar" } as const
    }
    if (await hayCuentaViva(cliente, datos.sesion.id)) {
      return { tipo: "cuenta_pedida" } as const
    }
    try {
      let primero: string | null = null
      for (const grupo of grupos) {
        const pedidoId = await crearComandaDeDestino(cliente, datos, clave, grupo)
        primero = primero ?? pedidoId
      }
      return { tipo: "ok", pedidoId: primero ?? "" } as const
    } catch (error) {
      if (esConflictoDeIdempotencia(error)) {
        return { tipo: "conflicto" } as const
      }
      throw error
    }
  })
  if ("fallo" in envuelto) {
    return envuelto.fallo === "codigo_desconocido"
      ? { tipo: "codigo_desconocido" }
      : { tipo: "sin_sesion" }
  }
  if (envuelto.valor.tipo === "conflicto") {
    return (await recuperarEnvio(cadena, codigo, sesionId, clave, grupos)) ?? { tipo: "sin_sesion" }
  }
  return envuelto.valor
}

type FilaPedido = {
  readonly id: string
  readonly status: string
  readonly creada: number
  readonly puesto_nombre: string | null
}

type FilaPedidoItem = {
  readonly order_id: string
  readonly name_snapshot: string
  readonly qty: number
  readonly line_total_clp: number
}

/** Las comandas de la sesion, con sus lineas y el total real de la carta. */
async function cargarPedidos(
  cliente: Client,
  sesionId: string,
): Promise<readonly PedidoDelComensal[]> {
  const ordenes = await cliente.query<FilaPedido>(
    `select o.id, o.status,
            extract(epoch from (now() - o.created_at))::int as creada,
            coalesce(ks.name, o.prep_station) as puesto_nombre
       from public.orders o
       left join public.kitchen_stations ks on ks.id = o.prep_station_id
      where o.session_id = $1
      order by o.created_at desc, o.id desc`,
    [sesionId],
  )
  if (ordenes.rows.length === 0) {
    return []
  }
  const items = await cliente.query<FilaPedidoItem>(
    `select order_id, name_snapshot, qty, line_total_clp
       from public.order_items
      where order_id = any($1::uuid[])
      order by created_at, id`,
    [ordenes.rows.map((fila) => fila.id)],
  )
  const porOrden = new Map<string, LineaDelPedido[]>()
  for (const item of items.rows) {
    const lista = porOrden.get(item.order_id) ?? []
    lista.push({ nombre: item.name_snapshot, cantidad: item.qty, totalClp: item.line_total_clp })
    porOrden.set(item.order_id, lista)
  }
  return ordenes.rows.map((fila): PedidoDelComensal => {
    const lineas = porOrden.get(fila.id) ?? []
    return {
      id: fila.id,
      destino: fila.puesto_nombre ?? "Sin puesto",
      estado: fila.status,
      creadoHaceSegundos: fila.creada,
      lineas,
      totalClp: totalDeLineas(lineas),
    }
  })
}

/** La pantalla de pedidos: el local, la mesa, las comandas y el acumulado vivo. */
async function leerPedidos(
  cadena: string,
  codigo: string,
  sesionId: string | null,
): Promise<LecturaPedidos> {
  const envuelto = await comoComensal(cadena, codigo, sesionId, async (cliente, datos) => {
    const local = await cliente.query<{ name: string }>(
      "select name from public.locations where id = $1",
      [datos.mesa.location_id],
    )
    const pedidos = await cargarPedidos(cliente, datos.sesion.id)
    return {
      local: local.rows[0]?.name ?? "Tu local",
      mesa: datos.mesa.label,
      pedidos,
      // Lo que el comensal lleva pedido: la suma de las comandas vivas, sin las anuladas.
      subtotalAcumuladoClp: subtotalDePedidos(pedidos),
      cuentaPedida: await hayCuentaViva(cliente, datos.sesion.id),
    }
  })
  if ("fallo" in envuelto) {
    return envuelto.fallo === "codigo_desconocido"
      ? { tipo: "codigo_desconocido" }
      : { tipo: "sin_sesion" }
  }
  return {
    tipo: "ok",
    local: envuelto.valor.local,
    mesa: envuelto.valor.mesa,
    pedidos: envuelto.valor.pedidos,
    subtotalAcumuladoClp: envuelto.valor.subtotalAcumuladoClp,
    cuentaPedida: envuelto.valor.cuentaPedida,
  }
}

/**
 * El comensal pide la cuenta. Se registra una sola peticion viva por sesion: volver a pedirla
 * no crea otra ni falla, simplemente confirma que ya esta pedida. Pedirla cierra la via de
 * pedir platos (la barrera esta en la base, no en el boton).
 */
async function pedirLaCuenta(
  cadena: string,
  codigo: string,
  sesionId: string | null,
): Promise<ResultadoCuenta> {
  const envuelto = await comoComensal(cadena, codigo, sesionId, async (cliente, datos) => {
    if (datos.sesion.state !== "active") {
      return { tipo: "sin_aprobar" } as const
    }
    if (!(await hayCuentaViva(cliente, datos.sesion.id))) {
      await cliente.query(
        `insert into public.bill_requests (session_id, split_mode, state)
         values ($1, 'none', 'requested')`,
        [datos.sesion.id],
      )
    }
    return { tipo: "ok" } as const
  })
  if ("fallo" in envuelto) {
    return envuelto.fallo === "codigo_desconocido"
      ? { tipo: "codigo_desconocido" }
      : { tipo: "sin_sesion" }
  }
  return envuelto.valor
}

export function almacenComensalDeBase(cadena: string): AlmacenComensal {
  return {
    abrir: (codigo, sesionId) => enTransaccion(cadena, false, codigo, sesionId),
    pedir: (codigo, sesionId) => enTransaccion(cadena, true, codigo, sesionId),
    enviar: (codigo, sesionId, clave, lineas) =>
      enviarComanda(cadena, codigo, sesionId, clave, lineas),
    pedidos: (codigo, sesionId) => leerPedidos(cadena, codigo, sesionId),
    pedirCuenta: (codigo, sesionId) => pedirLaCuenta(cadena, codigo, sesionId),
  }
}

/** Sin base no se resuelve nada: se falla cerrado, nunca se inventa una carta. */
export function almacenComensalNoConfigurado(): AlmacenComensal {
  const desconocido = async (): Promise<LecturaComensal> => ({ tipo: "codigo_desconocido" })
  return {
    abrir: desconocido,
    pedir: desconocido,
    enviar: async () => ({ tipo: "codigo_desconocido" }),
    pedidos: async () => ({ tipo: "codigo_desconocido" }),
    pedirCuenta: async () => ({ tipo: "codigo_desconocido" }),
  }
}

export function comensalDeEntorno(entorno: {
  readonly BASE?: { readonly connectionString: string }
}): AlmacenComensal {
  const cadena = entorno.BASE?.connectionString
  return cadena === undefined || cadena === ""
    ? almacenComensalNoConfigurado()
    : almacenComensalDeBase(cadena)
}
