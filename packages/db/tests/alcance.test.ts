/**
 * Correcciones de alcance: el encargado de organizacion y el cobro imputado.
 *
 * Se comprueban dos reglas que no estaban cubiertas:
 *
 *  1. Un encargado SIN local asignado ve los locales, la carta y las comandas de su
 *     organizacion; un camarero sin local no ve nada. La diferencia es el ROL, no tener
 *     local. Se resuelve leyendo solo de `staff`, sin abrir el ciclo
 *     `locations -> table_sessions -> locations` que abrio un intento anterior.
 *  2. Un cobro solo se puede registrar a nombre de quien lo hace.
 *
 * Se conectan como `camarero_app` (nunca el propietario: LL-004), con contextos de rol,
 * en transacciones que se revierten.
 */
import type { QueryResultRow } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

// ---------------------------------------------------------------------------
// Escenario
// ---------------------------------------------------------------------------

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_A2 = "aaaaaaaa-0000-0000-0000-000000000004"
const LOC_C = "cccccccc-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_C1 = "e0000000-0000-0000-0000-000000000003"
const SES_A = "f0000000-0000-0000-0000-000000000001"
const SES_C = "f0000000-0000-0000-0000-000000000003"
const ITEM_A = "04000000-0000-0000-0000-000000000001"
const ITEM_A2 = "04000000-0000-0000-0000-000000000002"
const ITEM_C = "04000000-0000-0000-0000-000000000003"

// Empleados: un encargado y un camarero, ambos SIN local; y un camarero CON local.
const MANAGER1 = "b0000000-0000-0000-0000-000000000010"
const SERVER_SIN = "b0000000-0000-0000-0000-000000000011"
const SERVER_A = "b0000000-0000-0000-0000-000000000012"

type Contexto = {
  orgId?: string
  staffId?: string
  role?: string
  sessionId?: string
  deviceAlias?: string
}

const CONTEXTO_MANAGER1: Contexto = { orgId: ORG1, staffId: MANAGER1, role: "location_manager" }
const CONTEXTO_SERVER_SIN: Contexto = { orgId: ORG1, staffId: SERVER_SIN, role: "server" }
const CONTEXTO_SERVER_A: Contexto = { orgId: ORG1, staffId: SERVER_A, role: "server" }

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

async function conContexto<T extends QueryResultRow>(
  contexto: Contexto,
  sql: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    await aplicarContexto(cliente, contexto)
    const resultado = await cliente.query<T>(sql, valores)
    return resultado.rows
  } finally {
    await cliente.query("rollback")
  }
}

async function contar(contexto: Contexto, tabla: string): Promise<number> {
  const filas = await conContexto<{ n: number }>(
    contexto,
    `select count(*)::int as n from public.${tabla}`,
  )
  return filas[0]?.n ?? -1
}

async function sembrarEscenario(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values
        ('${ORG1}', 'Organizacion Uno'),
        ('${ORG2}', 'Organizacion Dos');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'active'),
        ('${LOC_A2}', '${ORG1}', 'local-a2', 'Local A2', 'active'),
        ('${LOC_C}', '${ORG2}', 'local-c', 'Local C', 'active');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${MANAGER1}', '${ORG1}', null, 'manager1@org1.test', 'location_manager', 'Encargado Uno'),
        ('${SERVER_SIN}', '${ORG1}', null, 'serverSin@org1.test', 'server', 'Camarero Sin Local'),
        ('${SERVER_A}', '${ORG1}', '${LOC_A}', 'serverA@org1.test', 'server', 'Camarero A');

      insert into public.zones (id, location_id, name, kind) values
        ('d0000000-0000-0000-0000-000000000001', '${LOC_A}', 'Sala A', 'sala'),
        ('d0000000-0000-0000-0000-000000000003', '${LOC_C}', 'Sala C', 'sala');

      insert into public.tables (id, location_id, zone_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'd0000000-0000-0000-0000-000000000001', 'Mesa A1', 'ABCDEFGH'),
        ('${MESA_C1}', '${LOC_C}', 'd0000000-0000-0000-0000-000000000003', 'Mesa C1', 'ABCDEFGK');

      insert into public.table_links (group_id, table_id, role) values
        ('${MESA_A1}', '${MESA_A1}', 'primary'),
        ('${MESA_C1}', '${MESA_C1}', 'primary');

      insert into public.menu_categories (id, location_id, name_i18n) values
        ('03000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Entrantes A"}'),
        ('03000000-0000-0000-0000-000000000003', '${LOC_C}', '{"es":"Entrantes C"}');

      insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, active, available) values
        ('${ITEM_A}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Empanada A"}', 1500, true, true),
        ('${ITEM_A2}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Empanada A2"}', 1200, true, true),
        ('${ITEM_C}', '${LOC_C}', '03000000-0000-0000-0000-000000000003', '{"es":"Empanada C"}', 1500, true, true);

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'SESION-A', 'active'),
        ('${SES_C}', '${ORG2}', '${LOC_C}', '${MESA_C1}', 'SESION-C', 'active');

      insert into public.orders (id, org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key) values
        ('01000000-0000-0000-0000-000000000001', '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'pendiente', 0, 0, 'idem-a'),
        ('01000000-0000-0000-0000-000000000003', '${ORG2}', '${LOC_C}', '${SES_C}', 'table', 'pendiente', 0, 0, 'idem-c');
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
// El encargado sin local alcanza su organizacion
// ---------------------------------------------------------------------------

describe("Alcance: encargado sin local asignado", () => {
  it("debe ver los locales de su organizacion y no los de otra", async () => {
    const locales = await conContexto<{ slug: string }>(
      CONTEXTO_MANAGER1,
      `select slug from public.locations order by slug`,
    )
    expect(locales.map((l) => l.slug)).toEqual(["local-a", "local-a2"])
  })

  it("debe ver la carta de su organizacion y no la de otra", async () => {
    expect(await contar(CONTEXTO_MANAGER1, "menu_items")).toBe(2)
  })

  it("debe ver las comandas de su organizacion y no las de otra", async () => {
    const comandas = await conContexto<{ id: string }>(
      CONTEXTO_MANAGER1,
      `select id from public.orders`,
    )
    expect(comandas).toHaveLength(1)
    expect(comandas[0]?.id).toBe("01000000-0000-0000-0000-000000000001")
  })
})

// ---------------------------------------------------------------------------
// El camarero sin local no ve nada
// ---------------------------------------------------------------------------

describe("Alcance: camarero sin local asignado", () => {
  it("no debe ver locales, carta ni comandas", async () => {
    expect(await contar(CONTEXTO_SERVER_SIN, "locations")).toBe(0)
    expect(await contar(CONTEXTO_SERVER_SIN, "menu_items")).toBe(0)
    expect(await contar(CONTEXTO_SERVER_SIN, "orders")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// El cobro se imputa a quien lo registra
// ---------------------------------------------------------------------------

describe("Alcance: imputacion del cobro", () => {
  it("debe rechazar un cobro a nombre de otro empleado", async () => {
    await expect(
      conContexto(
        CONTEXTO_SERVER_A,
        `insert into public.checkouts (session_id, settled_by_staff_id, payment_method, total_clp, tip_clp)
         values ($1, $2, 'tpv_cash', 2000, 0)`,
        [SES_A, SERVER_SIN],
      ),
    ).rejects.toThrow()
  })

  it("debe aceptar un cobro a nombre de quien lo registra", async () => {
    const filas = await conContexto<{ n: number }>(
      CONTEXTO_SERVER_A,
      `with insertado as (
         insert into public.checkouts (session_id, settled_by_staff_id, payment_method, total_clp, tip_clp)
         values ($1, $2, 'tpv_cash', 2000, 0)
         returning 1
       )
       select count(*)::int as n from insertado`,
      [SES_A, SERVER_A],
    )
    expect(filas[0]?.n).toBe(1)
  })
})
