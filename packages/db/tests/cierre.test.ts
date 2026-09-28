/**
 * El cierre de importes: la cuenta se cierra cuando el personal acepta la comanda.
 *
 * Aqui se reproduce el ataque completo: un comensal crea una comanda con el descuento
 * igual al bruto y el total a cero, y luego el camarero la acepta. En el mismo escenario se
 * comprueba que no se puede rodear el cierre creando la comanda ya aceptada ni anadiendo
 * lineas despues.
 *
 * Se conectan como `camarero_app` (nunca el propietario: LL-004). El ataque cruza dos
 * roles (comensal y camarero), asi que se hace en UNA transaccion cambiando el contexto
 * entre medias; la transaccion se revierte al final.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

// ---------------------------------------------------------------------------
// Escenario
// ---------------------------------------------------------------------------

const ORG1 = "11111111-1111-1111-1111-111111111111"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const SES_A = "f0000000-0000-0000-0000-000000000001"
const ITEM_A = "04000000-0000-0000-0000-000000000001" // "Empanada", 1500 CLP
const OPCION_QUESO = "06000000-0000-0000-0000-000000000001" // "Queso", +500 CLP
const STAFF_SERVER_A = "b0000000-0000-0000-0000-000000000002"

// Ids que crea este test.
const ORDEN = "0a000000-0000-0000-0000-000000000001"
const ORDEN_FORZADA = "0a000000-0000-0000-0000-000000000002"
const LINEA = "0b000000-0000-0000-0000-000000000001"
const LINEA_TARDIA = "0b000000-0000-0000-0000-000000000002"
const MODIFICADOR = "0c000000-0000-0000-0000-000000000001"

type Contexto = {
  orgId?: string
  staffId?: string
  role?: string
  sessionId?: string
  deviceAlias?: string
}

const COMENSAL: Contexto = { sessionId: SES_A, deviceAlias: "alias-a" }
const CAMARERO: Contexto = { orgId: ORG1, staffId: STAFF_SERVER_A, role: "server" }

let entorno: EntornoDePruebas | undefined
let app: ClientePostgres | undefined

function clienteApp(): ClientePostgres {
  if (app === undefined) {
    throw new Error("El cliente de aplicacion no esta conectado")
  }
  return app
}

async function aplicarContexto(cliente: ClientePostgres, contexto: Contexto): Promise<void> {
  const pares: Array<[string, string]> = [
    ["app.org_id", contexto.orgId ?? ""],
    ["app.staff_id", contexto.staffId ?? ""],
    ["app.role", contexto.role ?? ""],
    ["app.location_id", ""],
    ["app.session_id", contexto.sessionId ?? ""],
    ["app.device_alias", contexto.deviceAlias ?? ""],
  ]
  for (const [clave, valor] of pares) {
    await cliente.query("select set_config($1, $2, true)", [clave, valor])
  }
}

/**
 * Ejecuta un guion dentro de una transaccion que se revierte. El guion recibe un helper
 * para cambiar de contexto sobre la marcha, que es lo que permite atacar como comensal y
 * cerrar como camarero en la misma operacion.
 */
async function enUnaTransaccion<T>(
  guion: (cliente: ClientePostgres, como: (contexto: Contexto) => Promise<void>) => Promise<T>,
): Promise<T> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    return await guion(cliente, (contexto) => aplicarContexto(cliente, contexto))
  } finally {
    await cliente.query("rollback")
  }
}

async function sembrarEscenario(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values ('${ORG1}', 'Organizacion Uno');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'active');

      insert into public.zones (id, location_id, name, kind) values
        ('d0000000-0000-0000-0000-000000000001', '${LOC_A}', 'Sala A', 'sala');

      insert into public.tables (id, location_id, zone_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'd0000000-0000-0000-0000-000000000001', 'Mesa A1', 'ABCDEFGH');

      insert into public.table_links (group_id, table_id, role) values
        ('${MESA_A1}', '${MESA_A1}', 'primary');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_SERVER_A}', '${ORG1}', '${LOC_A}', 'serverA@org1.test', 'server', 'Camarero A');

      insert into public.menu_categories (id, location_id, name_i18n) values
        ('03000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Entrantes A"}');

      insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, active, available) values
        ('${ITEM_A}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Empanada"}', 1500, true, true);

      insert into public.modifier_groups (id, location_id, name_i18n) values
        ('05000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Extras"}');

      insert into public.modifier_options (id, group_id, name_i18n, price_delta_clp) values
        ('${OPCION_QUESO}', '05000000-0000-0000-0000-000000000001', '{"es":"Queso"}', 500);

      insert into public.item_modifier_groups (item_id, group_id) values
        ('${ITEM_A}', '05000000-0000-0000-0000-000000000001');

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'SESION-A', 'active');

      insert into public.table_devices (id, session_id, device_alias) values
        ('0f000000-0000-0000-0000-000000000001', '${SES_A}', 'alias-a');
    `)
  } finally {
    await cerrar(cliente)
  }
}

/** Crea una comanda como comensal con descuento y total inventados. */
async function crearComandaAtaque(cliente: ClientePostgres, id: string): Promise<void> {
  await cliente.query(
    `insert into public.orders
       (id, org_id, location_id, session_id, source, status, subtotal_clp, discount_clp, total_clp, idempotency_key)
     values ($1, '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'pendiente', 1500, 1500, 0, $2)`,
    [id, `idem-${id}`],
  )
}

async function leerComanda(
  cliente: ClientePostgres,
  id: string,
): Promise<{ status: string; subtotal: number; discount: number; total: number }> {
  const filas = await cliente.query<{
    status: string
    subtotal_clp: number
    discount_clp: number
    total_clp: number
  }>(`select status, subtotal_clp, discount_clp, total_clp from public.orders where id = $1`, [id])
  const fila = filas.rows[0]
  if (fila === undefined) {
    throw new Error(`No se encontro la comanda ${id}`)
  }
  return {
    status: fila.status,
    subtotal: fila.subtotal_clp,
    discount: fila.discount_clp,
    total: fila.total_clp,
  }
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrarEscenario(entorno.parametros.admin)
  app = await conectar(parametrosApp())
}, 240_000)

function parametrosApp(): ParametrosConexion {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return entorno.parametros.app
}

afterAll(async () => {
  if (app !== undefined) {
    await cerrar(app)
  }
  entorno?.detener()
})

// ---------------------------------------------------------------------------
// El ataque completo
// ---------------------------------------------------------------------------

describe("Cierre de importes: el ataque del descuento", () => {
  it("debe descartar el descuento del comensal y cobrar el valor real de las lineas", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL)
      await crearComandaAtaque(cliente, ORDEN)
      // Linea con precio inventado (1) y modificador con delta inventado (1).
      await cliente.query(
        `insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
         values ($1, $2, '${ITEM_A}', 'Inventado', 1, 1, 1)`,
        [LINEA, ORDEN],
      )
      await cliente.query(
        `insert into public.order_item_modifiers (id, order_item_id, option_id, name_snapshot, price_delta_clp)
         values ($1, $2, '${OPCION_QUESO}', 'Inventado', 1)`,
        [MODIFICADOR, LINEA],
      )

      // Ahora el camarero la acepta.
      await como(CAMARERO)
      await cliente.query(`update public.orders set status = 'aceptada' where id = $1`, [ORDEN])

      const comanda = await leerComanda(cliente, ORDEN)
      const linea = await cliente.query<{ line_total_clp: number }>(
        `select line_total_clp from public.order_items where id = $1`,
        [LINEA],
      )
      return { comanda, lineTotal: linea.rows[0]?.line_total_clp }
    })

    // El descuento de 1500 que envio el comensal se descarta: la comanda queda a 2000
    // (empanada 1500 + queso 500), que es la suma real de las lineas.
    expect(resultado.comanda.status).toBe("aceptada")
    expect(resultado.comanda.discount).toBe(0)
    expect(resultado.comanda.subtotal).toBe(2000)
    expect(resultado.comanda.total).toBe(2000)
    // Y la linea lleva su valor final, con el modificador incluido.
    expect(resultado.lineTotal).toBe(2000)
  })
})

// ---------------------------------------------------------------------------
// No se puede rodear el cierre
// ---------------------------------------------------------------------------

describe("Cierre de importes: no se puede rodear", () => {
  it("debe forzar el estado pendiente aunque el comensal intente crear la comanda aceptada", async () => {
    const comanda = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL)
      // Intenta nacer ya aceptada y con 999999 de subtotal.
      await cliente.query(
        `insert into public.orders
           (id, org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key)
         values ($1, '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'aceptada', 999999, 999999, $2)`,
        [ORDEN_FORZADA, `idem-${ORDEN_FORZADA}`],
      )
      return leerComanda(cliente, ORDEN_FORZADA)
    })

    expect(comanda.status).toBe("pendiente")
    expect(comanda.subtotal).toBe(0)
    expect(comanda.total).toBe(0)
  })

  it("debe rechazar una linea anadida a una comanda ya aceptada", async () => {
    await expect(
      enUnaTransaccion(async (cliente, como) => {
        await como(COMENSAL)
        await crearComandaAtaque(cliente, ORDEN)
        await cliente.query(
          `insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
           values ($1, $2, '${ITEM_A}', 'Empanada', 1500, 1, 1500)`,
          [LINEA, ORDEN],
        )

        await como(CAMARERO)
        await cliente.query(`update public.orders set status = 'aceptada' where id = $1`, [ORDEN])

        // El comensal intenta anadir una linea despues de aceptada.
        await como(COMENSAL)
        return cliente.query(
          `insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
           values ($1, $2, '${ITEM_A}', 'Empanada', 1500, 1, 1500)`,
          [LINEA_TARDIA, ORDEN],
        )
      }),
    ).rejects.toThrow()
  })
})
