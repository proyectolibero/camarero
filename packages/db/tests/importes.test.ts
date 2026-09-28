/**
 * Integridad de importes: el precio lo fija la base, no el cliente.
 *
 * Estos tests atacan el agujero real que se encontro en el esquema: un comensal podia
 * insertar una linea con `unit_price_clp = 1` y la base se lo tragaba. Aqui se comprueba
 * que el disparador copia el precio y el nombre de la carta e ignora lo que envie el borde.
 *
 * Se conectan como `camarero_app` (nunca como el propietario: LL-004) y con contexto de
 * comensal, dentro de transacciones que se revierten.
 *
 * La migracion 0012 los hace pasar; antes de ella, el primer test falla con el precio
 * inventado. Esa es la prueba de que el test puede fallar, y por tanto de que vale.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

// ---------------------------------------------------------------------------
// Escenario: el mismo mundo que usa rls.test.ts, con identificadores fijos.
// ---------------------------------------------------------------------------

const ORG1 = "11111111-1111-1111-1111-111111111111"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const SES_A = "f0000000-0000-0000-0000-000000000001"
const ITEM_A = "04000000-0000-0000-0000-000000000001" // "Empanada", 1500 CLP
const OPCION_QUESO = "06000000-0000-0000-0000-000000000001" // "Queso", +500 CLP

// Comandas que crea este test. Ids fijos para poder afirmar por id.
const ORDEN_ATAQUE = "0a000000-0000-0000-0000-000000000001"
const ORDEN_SIN_PLATO = "0a000000-0000-0000-0000-000000000002"
const LINEA_ATAQUE = "0b000000-0000-0000-0000-000000000001"
const LINEA_INVENTADA = "0b000000-0000-0000-0000-000000000002"

type Contexto = {
  orgId?: string
  sessionId?: string
  deviceAlias?: string
}

const CONTEXTO_COMENSAL_A: Contexto = { sessionId: SES_A, deviceAlias: "alias-a" }

let entorno: EntornoDePruebas | undefined
let app: ClientePostgres | undefined

function clienteApp(): ClientePostgres {
  if (app === undefined) {
    throw new Error("El cliente de aplicacion no esta conectado")
  }
  return app
}

function parametrosApp(): ParametrosConexion {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return entorno.parametros.app
}

async function aplicarContexto(cliente: ClientePostgres, contexto: Contexto): Promise<void> {
  const pares: Array<[string, string]> = [
    ["app.org_id", contexto.orgId ?? ""],
    ["app.staff_id", ""],
    ["app.role", ""],
    ["app.location_id", ""],
    ["app.session_id", contexto.sessionId ?? ""],
    ["app.device_alias", contexto.deviceAlias ?? ""],
  ]
  for (const [clave, valor] of pares) {
    await cliente.query("select set_config($1, $2, true)", [clave, valor])
  }
}

/**
 * Ejecuta varias sentencias como comensal y devuelve lo que devuelva la ultima, todo
 * dentro de una transaccion que se revierte. Se hace asi porque el disparador necesita ver
 * la comanda y la linea dentro de la MISMA transaccion que el insert.
 */
async function comoComensal<T>(
  contexto: Contexto,
  guion: (cliente: ClientePostgres) => Promise<T>,
): Promise<T> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    await aplicarContexto(cliente, contexto)
    return await guion(cliente)
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

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrarEscenario(entorno.parametros.admin)
  app = await conectar(parametrosApp())
}, 240_000)

afterAll(async () => {
  if (app !== undefined) {
    await cerrar(app)
  }
  entorno?.detener()
})

// ---------------------------------------------------------------------------
// El ataque al precio
// ---------------------------------------------------------------------------

describe("Integridad de importes: precio de linea", () => {
  it("debe ignorar el precio enviado por el comensal cuando manda uno inventado", async () => {
    const filas = await comoComensal(CONTEXTO_COMENSAL_A, async (cliente) => {
      await cliente.query(
        `insert into public.orders (id, org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key)
         values ('${ORDEN_ATAQUE}', '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'pendiente', 0, 0, 'idem-ataque')`,
      )
      const resultado = await cliente.query<{
        unit_price_clp: number
        name_snapshot: string
        line_total_clp: number
      }>(
        `insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
         values ('${LINEA_ATAQUE}', '${ORDEN_ATAQUE}', '${ITEM_A}', 'Inventado', 1, 2, 2)
         returning unit_price_clp, name_snapshot, line_total_clp`,
      )
      return resultado.rows
    })

    // El comensal envio precio 1; la carta dice 1500. Gana la carta.
    expect(filas[0]?.unit_price_clp).toBe(1500)
    expect(filas[0]?.name_snapshot).toBe("Empanada")
    // Y el total de la linea se calcula con el precio de la carta: 1500 * 2 = 3000.
    expect(filas[0]?.line_total_clp).toBe(3000)
  })

  it("debe rechazar la linea cuando el comensal la deja sin plato de la carta", async () => {
    // Una linea sin menu_item_id no tiene precio valido posible: no se puede inventar.
    await expect(
      comoComensal(CONTEXTO_COMENSAL_A, async (cliente) => {
        await cliente.query(
          `insert into public.orders (id, org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key)
           values ('${ORDEN_SIN_PLATO}', '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'pendiente', 0, 0, 'idem-sin-plato')`,
        )
        return cliente.query(
          `insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
           values ('${LINEA_INVENTADA}', '${ORDEN_SIN_PLATO}', null, 'Fantasma', 1, 1, 1)`,
        )
      }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// El delta del modificador
// ---------------------------------------------------------------------------

describe("Integridad de importes: delta de modificador", () => {
  it("debe ignorar el delta enviado por el comensal cuando manda uno inventado", async () => {
    const filas = await comoComensal(CONTEXTO_COMENSAL_A, async (cliente) => {
      await cliente.query(
        `insert into public.orders (id, org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key)
         values ('${ORDEN_ATAQUE}', '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'pendiente', 0, 0, 'idem-ataque')`,
      )
      await cliente.query(
        `insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
         values ('${LINEA_ATAQUE}', '${ORDEN_ATAQUE}', '${ITEM_A}', 'Empanada', 1500, 1, 1500)`,
      )
      const resultado = await cliente.query<{ price_delta_clp: number; name_snapshot: string }>(
        `insert into public.order_item_modifiers (id, order_item_id, option_id, name_snapshot, price_delta_clp)
         values ('02100000-0000-0000-0000-000000000001', '${LINEA_ATAQUE}', '${OPCION_QUESO}', 'Inventado', 1)
         returning price_delta_clp, name_snapshot`,
      )
      return resultado.rows
    })

    // El comensal envio delta 1; la carta dice 500. Gana la carta.
    expect(filas[0]?.price_delta_clp).toBe(500)
    expect(filas[0]?.name_snapshot).toBe("Queso")
  })
})
