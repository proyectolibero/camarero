/**
 * RLS del Proyecto Camarero: aislamiento de personal y comensal anonimo.
 *
 * Los tests de comportamiento se ejecutan SIEMPRE como `camarero_app` (no propietario y
 * sin BYPASSRLS) y con el contexto de sesion (`set_config(..., true)`) dentro de una
 * transaccion que se revierte. Conectar con el propietario daria siempre verde sin probar
 * nada (LL-004). El sembrado de datos se hace como `camarero_admin` (superusuario), que
 * si puede saltar la RLS; asi se puede preparar un mundo con dos organizaciones y tres
 * locales sin relajar las politicas.
 */

import type { QueryResultRow } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

// ---------------------------------------------------------------------------
// Datos de prueba (identificadores fijos para poder afirmar por id)
// ---------------------------------------------------------------------------

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_B = "aaaaaaaa-0000-0000-0000-000000000002"
const LOC_C = "cccccccc-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_B1 = "e0000000-0000-0000-0000-000000000002"
const MESA_C1 = "e0000000-0000-0000-0000-000000000003"
const SES_A = "f0000000-0000-0000-0000-000000000001"
const SES_B = "f0000000-0000-0000-0000-000000000002"
const ORDEN_A = "01000000-0000-0000-0000-000000000001"
const ORDEN_B = "01000000-0000-0000-0000-000000000002"
const ITEM_A = "04000000-0000-0000-0000-000000000001"
const ITEM_A2 = "04000000-0000-0000-0000-000000000002"
const ITEM_B = "04000000-0000-0000-0000-000000000003"
const ITEM_C = "04000000-0000-0000-0000-000000000004"

const STAFF_OWNER1 = "b0000000-0000-0000-0000-000000000001"
const STAFF_SERVER_A = "b0000000-0000-0000-0000-000000000002"
const STAFF_KITCHEN_A = "b0000000-0000-0000-0000-000000000004"
const STAFF_PLATFORM = "b0000000-0000-0000-0000-000000000005"

const TABLAS_DEL_CONTRATO = [
  "orgs",
  "locations",
  "opening_hours",
  "zones",
  "tables",
  "table_links",
  "staff",
  "staff_devices",
  "audit_log",
  "menu_categories",
  "menu_items",
  "modifier_groups",
  "modifier_options",
  "item_modifier_groups",
  "table_sessions",
  "table_devices",
  "pairing_requests",
  "orders",
  "order_items",
  "order_item_modifiers",
  "promotions",
  "bill_requests",
  "checkouts",
  "push_subscriptions",
  "kitchen_stations",
  "daily_metrics",
  "ratelimit_counters",
  "idempotency_keys",
] as const

// La unica tabla del contrato sin politica: es de plataforma y solo la toca el rol de
// servicio (BYPASSRLS). Aqui se comprueba que, con RLS forzada, camarero_app no ve nada.
const TABLAS_SIN_POLITICA = ["ratelimit_counters"] as const

// ---------------------------------------------------------------------------
// Contexto de sesion
// ---------------------------------------------------------------------------

type Contexto = {
  orgId?: string
  staffId?: string
  role?: string
  locationId?: string
  sessionId?: string
  deviceAlias?: string
}

const CONTEXTO_OWNER1: Contexto = { orgId: ORG1, staffId: STAFF_OWNER1, role: "org_owner" }
const CONTEXTO_SERVER_A: Contexto = { orgId: ORG1, staffId: STAFF_SERVER_A, role: "server" }
const CONTEXTO_KITCHEN_A: Contexto = { orgId: ORG1, staffId: STAFF_KITCHEN_A, role: "kitchen" }
const CONTEXTO_PLATFORM: Contexto = { orgId: ORG1, staffId: STAFF_PLATFORM, role: "platform_admin" }
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
    ["app.staff_id", contexto.staffId ?? ""],
    ["app.role", contexto.role ?? ""],
    ["app.location_id", contexto.locationId ?? ""],
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

/** Ejecuta una escritura con contexto y devuelve cuantas filas resultaron afectadas. */
async function escribirConContexto(
  contexto: Contexto,
  sql: string,
  valores: unknown[] = [],
): Promise<number> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    await aplicarContexto(cliente, contexto)
    const resultado = await cliente.query(sql, valores)
    return resultado.rowCount ?? 0
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

// ---------------------------------------------------------------------------
// Sembrado
// ---------------------------------------------------------------------------

async function sembrar(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values
        ('${ORG1}', 'Organizacion Uno'),
        ('${ORG2}', 'Organizacion Dos');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'active'),
        ('${LOC_B}', '${ORG1}', 'local-b', 'Local B', 'active'),
        ('${LOC_C}', '${ORG2}', 'local-c', 'Local C', 'active');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_OWNER1}', '${ORG1}', null, 'owner1@org1.test', 'org_owner', 'Duena Uno'),
        ('${STAFF_SERVER_A}', '${ORG1}', '${LOC_A}', 'serverA@org1.test', 'server', 'Camarero A'),
        ('b0000000-0000-0000-0000-000000000003', '${ORG1}', '${LOC_B}', 'serverB@org1.test', 'server', 'Camarero B'),
        ('${STAFF_KITCHEN_A}', '${ORG1}', '${LOC_A}', 'kitchenA@org1.test', 'kitchen', 'Cocina A'),
        ('${STAFF_PLATFORM}', '${ORG1}', null, 'plataforma@camarero.test', 'platform_admin', 'Plataforma');

      insert into public.opening_hours (location_id, weekday, opens_at, closes_at, closed) values
        ('${LOC_A}', 1, '12:00', '23:00', false);

      insert into public.zones (id, location_id, name, kind) values
        ('d0000000-0000-0000-0000-000000000001', '${LOC_A}', 'Sala A', 'sala'),
        ('d0000000-0000-0000-0000-000000000002', '${LOC_B}', 'Sala B', 'sala'),
        ('d0000000-0000-0000-0000-000000000003', '${LOC_C}', 'Sala C', 'sala');

      insert into public.tables (id, location_id, zone_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'd0000000-0000-0000-0000-000000000001', 'Mesa A1', 'ABCDEFGH'),
        ('${MESA_B1}', '${LOC_B}', 'd0000000-0000-0000-0000-000000000002', 'Mesa B1', 'ABCDEFGJ'),
        ('${MESA_C1}', '${LOC_C}', 'd0000000-0000-0000-0000-000000000003', 'Mesa C1', 'ABCDEFGK');

      insert into public.table_links (group_id, table_id, role) values
        ('${MESA_A1}', '${MESA_A1}', 'primary');

      insert into public.staff_devices (id, staff_id, device_token) values
        ('0d000000-0000-0000-0000-000000000001', '${STAFF_SERVER_A}', 'token-a');

      insert into public.audit_log (id, org_id, actor_staff_id, action, entity, entity_id) values
        ('a0000000-0000-0000-0000-000000000001', '${ORG1}', '${STAFF_OWNER1}', 'order.created', 'order', '${ORDEN_A}'),
        ('a0000000-0000-0000-0000-000000000002', '${ORG2}', null, 'order.created', 'order', null);

      insert into public.menu_categories (id, location_id, name_i18n) values
        ('03000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Entrantes A"}'),
        ('03000000-0000-0000-0000-000000000002', '${LOC_B}', '{"es":"Entrantes B"}'),
        ('03000000-0000-0000-0000-000000000003', '${LOC_C}', '{"es":"Entrantes C"}');

      insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, active, available) values
        ('${ITEM_A}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Empanada"}', 1500, true, true),
        ('${ITEM_A2}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Agotado"}', 1000, true, false),
        ('${ITEM_B}', '${LOC_B}', '03000000-0000-0000-0000-000000000002', '{"es":"Empanada B"}', 1500, true, true),
        ('${ITEM_C}', '${LOC_C}', '03000000-0000-0000-0000-000000000003', '{"es":"Empanada C"}', 1500, true, true);

      insert into public.modifier_groups (id, location_id, name_i18n) values
        ('05000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Extras"}');

      insert into public.modifier_options (id, group_id, name_i18n, price_delta_clp) values
        ('06000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000001', '{"es":"Queso"}', 500);

      insert into public.item_modifier_groups (item_id, group_id) values
        ('${ITEM_A}', '05000000-0000-0000-0000-000000000001');

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'SESION-A', 'active'),
        ('${SES_B}', '${ORG1}', '${LOC_B}', '${MESA_B1}', 'SESION-B', 'active'),
        ('f0000000-0000-0000-0000-000000000003', '${ORG2}', '${LOC_C}', '${MESA_C1}', 'SESION-C', 'active');

      insert into public.table_devices (id, session_id, device_alias) values
        ('0f000000-0000-0000-0000-000000000001', '${SES_A}', 'alias-a');

      insert into public.pairing_requests (id, session_id, table_id, state) values
        ('10000000-0000-0000-0000-000000000001', '${SES_A}', '${MESA_A1}', 'pending');

      insert into public.orders (id, org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key) values
        ('${ORDEN_A}', '${ORG1}', '${LOC_A}', '${SES_A}', 'table', 'pendiente', 1500, 1500, 'idem-a'),
        ('${ORDEN_B}', '${ORG1}', '${LOC_B}', '${SES_B}', 'table', 'pendiente', 1500, 1500, 'idem-b'),
        ('01000000-0000-0000-0000-000000000003', '${ORG2}', '${LOC_C}', 'f0000000-0000-0000-0000-000000000003', 'table', 'pendiente', 1500, 1500, 'idem-c');

      insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp) values
        ('02000000-0000-0000-0000-000000000001', '${ORDEN_A}', '${ITEM_A}', 'Empanada', 1500, 1, 1500),
        ('02000000-0000-0000-0000-000000000002', '${ORDEN_B}', '${ITEM_B}', 'Empanada B', 1500, 1, 1500);

      insert into public.order_item_modifiers (id, order_item_id, option_id, name_snapshot, price_delta_clp) values
        ('02100000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-000000000001', '06000000-0000-0000-0000-000000000001', 'Queso', 500);

      insert into public.promotions (id, location_id, kind, code, value) values
        ('07000000-0000-0000-0000-000000000001', '${LOC_A}', 'percent', 'PROMO10', 10);

      insert into public.bill_requests (id, session_id, split_mode, tip_percent, state) values
        ('08000000-0000-0000-0000-000000000001', '${SES_A}', 'equal', 10, 'requested');

      insert into public.checkouts (id, bill_request_id, session_id, settled_by_staff_id, payment_method, total_clp, tip_clp) values
        ('09000000-0000-0000-0000-000000000001', '08000000-0000-0000-0000-000000000001', '${SES_A}', '${STAFF_SERVER_A}', 'tpv_card', 1500, 150);

      insert into public.push_subscriptions (id, staff_id, endpoint, p256dh, auth) values
        ('c0000000-0000-0000-0000-000000000001', '${STAFF_SERVER_A}', 'https://push.test/a', 'clave', 'secreto');

      insert into public.kitchen_stations (id, location_id, name, kind) values
        ('0e000000-0000-0000-0000-000000000001', '${LOC_A}', 'Parrilla', 'caliente');

      insert into public.daily_metrics (location_id, date, orders, covers, clp_gross) values
        ('${LOC_A}', '2026-09-01', 1, 2, 1500),
        ('${LOC_B}', '2026-09-01', 1, 2, 1500),
        ('${LOC_C}', '2026-09-01', 1, 2, 1500);

      insert into public.idempotency_keys (key, org_id, response_json) values
        ('idem-a', '${ORG1}', '{"ok":true}'),
        ('idem-c', '${ORG2}', '{"ok":true}');

      insert into public.ratelimit_counters (bucket, window_start, count) values
        ('local-a', '2026-09-01T00:00:00Z', 1);
    `)
  } finally {
    await cerrar(cliente)
  }
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrar(entorno.parametros.admin)
  app = await conectar(parametrosApp())
}, 240_000)

afterAll(async () => {
  await cerrar(app)
  if (entorno !== undefined) {
    entorno.detener()
  }
})

// ---------------------------------------------------------------------------
// Metadatos de las tablas: RLS activada, forzada y con politica
// ---------------------------------------------------------------------------

describe("Cobertura de RLS en las 28 tablas del contrato", () => {
  it("debe tener RLS activada y forzada en todas, y al menos una politica salvo las de plataforma", async () => {
    const filas = await conectarYConsultar(
      parametrosApp(),
      `select c.relname as tabla,
              c.relrowsecurity as rls,
              c.relforcerowsecurity as fuerza,
              (select count(*)::int from pg_policies p
                where p.schemaname = 'public' and p.tablename = c.relname) as politicas
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'prueba_runner'
        order by c.relname`,
    )
    const porTabla = new Map(filas.map((f) => [f.tabla, f]))

    expect([...porTabla.keys()].sort()).toEqual([...TABLAS_DEL_CONTRATO].sort())

    for (const tabla of TABLAS_DEL_CONTRATO) {
      const fila = porTabla.get(tabla)
      expect(fila, `falta la tabla ${tabla}`).toBeDefined()
      expect(fila?.rls, `${tabla} no tiene RLS activada`).toBe(true)
      expect(fila?.fuerza, `${tabla} no tiene FORCE RLS`).toBe(true)
      const sinPolitica = (TABLAS_SIN_POLITICA as readonly string[]).includes(tabla)
      if (sinPolitica) {
        expect(fila?.politicas, `${tabla} no deberia tener politicas`).toBe(0)
      } else {
        expect(Number(fila?.politicas), `${tabla} no tiene ninguna politica`).toBeGreaterThan(0)
      }
    }
  })

  it("no debe ser camarero_app propietario de ninguna tabla ni tener BYPASSRLS", async () => {
    const filas = await conectarYConsultar(
      parametrosApp(),
      `select count(*)::int as n from pg_tables
        where schemaname = 'public' and tableowner = 'camarero_app'`,
    )
    expect(filas[0]?.n).toBe(0)
    const rol = await conectarYConsultar(
      parametrosApp(),
      "select rolbypassrls as bypass from pg_roles where rolname = 'camarero_app'",
    )
    expect(rol[0]?.bypass).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Comportamiento por actor
// ---------------------------------------------------------------------------

describe("platform_admin", () => {
  it("debe ver todas las organizaciones y todos los locales cuando no acota", async () => {
    expect(await contar(CONTEXTO_PLATFORM, "orgs")).toBe(2)
    expect(await contar(CONTEXTO_PLATFORM, "locations")).toBe(3)
    expect(await contar(CONTEXTO_PLATFORM, "orders")).toBe(3)
    expect(await contar(CONTEXTO_PLATFORM, "staff")).toBe(5)
  })

  it("no debe ver los contadores de plataforma, que solo toca el rol de servicio", async () => {
    expect(await contar(CONTEXTO_PLATFORM, "ratelimit_counters")).toBe(0)
  })
})

describe("org_owner", () => {
  it("debe ver los dos locales de su organizacion y nada de la otra", async () => {
    expect(await contar(CONTEXTO_OWNER1, "locations")).toBe(2)
    expect(await contar(CONTEXTO_OWNER1, "orgs")).toBe(1)
    const deOtraOrg = await conContexto<{ n: number }>(
      CONTEXTO_OWNER1,
      `select count(*)::int as n from public.orders where org_id = $1`,
      [ORG2],
    )
    expect(deOtraOrg[0]?.n).toBe(0)
  })

  it("debe ver las comandas de su organizacion y solo esas", async () => {
    expect(await contar(CONTEXTO_OWNER1, "orders")).toBe(2)
    expect(await contar(CONTEXTO_OWNER1, "checkouts")).toBe(1)
    expect(await contar(CONTEXTO_OWNER1, "daily_metrics")).toBe(2)
  })
})

describe("server del local A", () => {
  it("no debe ver mesas ni comandas del local B de su misma organizacion", async () => {
    expect(await contar(CONTEXTO_SERVER_A, "tables")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "orders")).toBe(1)
    const mesaB = await conContexto<{ n: number }>(
      CONTEXTO_SERVER_A,
      `select count(*)::int as n from public.tables where id = $1`,
      [MESA_B1],
    )
    expect(mesaB[0]?.n).toBe(0)
    const ordenB = await conContexto<{ n: number }>(
      CONTEXTO_SERVER_A,
      `select count(*)::int as n from public.orders where id = $1`,
      [ORDEN_B],
    )
    expect(ordenB[0]?.n).toBe(0)
  })

  it("solo debe ver los platos de su local", async () => {
    expect(await contar(CONTEXTO_SERVER_A, "menu_items")).toBe(2)
  })
})

describe("kitchen", () => {
  it("debe poder cambiar el estado de una comanda de su local", async () => {
    const afectadas = await escribirConContexto(
      CONTEXTO_KITCHEN_A,
      `update public.orders set status = 'aceptada' where id = $1`,
      [ORDEN_A],
    )
    expect(afectadas).toBe(1)
  })

  it("no debe poder modificar el precio de un plato", async () => {
    const afectadas = await escribirConContexto(
      CONTEXTO_KITCHEN_A,
      `update public.menu_items set price_clp = 1 where id = $1`,
      [ITEM_A],
    )
    expect(afectadas).toBe(0)
  })
})

describe("comensal anonimo", () => {
  it("no debe leer staff, audit_log, checkouts ni daily_metrics", async () => {
    expect(await contar(CONTEXTO_COMENSAL_A, "staff")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "staff_devices")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "audit_log")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "checkouts")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "daily_metrics")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "ratelimit_counters")).toBe(0)
  })

  it("no debe leer la comanda de otra sesion", async () => {
    expect(await contar(CONTEXTO_COMENSAL_A, "orders")).toBe(1)
    const otra = await conContexto<{ n: number }>(
      CONTEXTO_COMENSAL_A,
      `select count(*)::int as n from public.orders where session_id = $1`,
      [SES_B],
    )
    expect(otra[0]?.n).toBe(0)
  })

  it("no debe leer la carta de otro local", async () => {
    const otraCarta = await conContexto<{ n: number }>(
      CONTEXTO_COMENSAL_A,
      `select count(*)::int as n from public.menu_items where location_id = $1`,
      [LOC_B],
    )
    expect(otraCarta[0]?.n).toBe(0)
  })

  it("si debe leer la carta activa y disponible de su local", async () => {
    // itemA esta activo y disponible; itemA2 esta activo pero agotado y no debe verse.
    expect(await contar(CONTEXTO_COMENSAL_A, "menu_items")).toBe(1)
    const disponible = await conContexto<{ n: number }>(
      CONTEXTO_COMENSAL_A,
      `select count(*)::int as n from public.menu_items where id = $1`,
      [ITEM_A],
    )
    expect(disponible[0]?.n).toBe(1)
    const agotado = await conContexto<{ n: number }>(
      CONTEXTO_COMENSAL_A,
      `select count(*)::int as n from public.menu_items where id = $1`,
      [ITEM_A2],
    )
    expect(agotado[0]?.n).toBe(0)
  })

  it("debe ver su propia sesion, su local y su mesa", async () => {
    expect(await contar(CONTEXTO_COMENSAL_A, "table_sessions")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "locations")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "tables")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "table_devices")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "pairing_requests")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "bill_requests")).toBe(1)
  })

  it("no debe ver promociones ni idempotencia de la organizacion", async () => {
    expect(await contar(CONTEXTO_COMENSAL_A, "promotions")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "idempotency_keys")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Cobertura del resto de tablas
// ---------------------------------------------------------------------------

describe("cobertura del resto de tablas", () => {
  it("el server del local A ve su operativa y su carta, no la del local B", async () => {
    expect(await contar(CONTEXTO_SERVER_A, "zones")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "opening_hours")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "kitchen_stations")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "table_links")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "menu_categories")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "modifier_groups")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "modifier_options")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "item_modifier_groups")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "daily_metrics")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "checkouts")).toBe(1)
  })

  it("el dueno ve lineas, modificadores, personal e idempotencia de su organizacion", async () => {
    expect(await contar(CONTEXTO_OWNER1, "order_items")).toBe(2)
    expect(await contar(CONTEXTO_OWNER1, "order_item_modifiers")).toBe(1)
    expect(await contar(CONTEXTO_OWNER1, "staff")).toBe(5)
    expect(await contar(CONTEXTO_OWNER1, "idempotency_keys")).toBe(1)
  })

  it("el comensal ve la carta de su local y no la operativa interna", async () => {
    expect(await contar(CONTEXTO_COMENSAL_A, "menu_categories")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "modifier_groups")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "modifier_options")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "item_modifier_groups")).toBe(1)
    expect(await contar(CONTEXTO_COMENSAL_A, "zones")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "kitchen_stations")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "promotions")).toBe(0)
    expect(await contar(CONTEXTO_COMENSAL_A, "table_links")).toBe(0)
  })

  it("solo se ven los dispositivos y suscripciones push propios o de la organizacion", async () => {
    expect(await contar(CONTEXTO_SERVER_A, "staff_devices")).toBe(1)
    expect(await contar(CONTEXTO_SERVER_A, "push_subscriptions")).toBe(1)
    expect(await contar(CONTEXTO_OWNER1, "staff_devices")).toBe(1)
    expect(await contar(CONTEXTO_OWNER1, "push_subscriptions")).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Defecto: denegar. Sin actor, ninguna fila.
// ---------------------------------------------------------------------------

describe("contexto vacio", () => {
  it("no debe ver ninguna fila en ninguna tabla del contrato", async () => {
    for (const tabla of TABLAS_DEL_CONTRATO) {
      expect(await contar({}, tabla), `con contexto vacio se ven filas en ${tabla}`).toBe(0)
    }
  })

  it("si se ven filas cuando hay actor, para que la prueba anterior no sea vacua", async () => {
    const conFilas = ["orgs", "locations", "orders", "menu_items", "table_sessions", "audit_log"]
    for (const tabla of conFilas) {
      expect(await contar(CONTEXTO_PLATFORM, tabla), `plataforma no ve ${tabla}`).toBeGreaterThan(0)
    }
    // ratelimit_counters no tiene politica: ni siquiera plataforma la ve.
    expect(await contar(CONTEXTO_PLATFORM, "ratelimit_counters")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// audit_log inmutable
// ---------------------------------------------------------------------------

describe("audit_log", () => {
  it("debe permitir insertar pero no modificar ni borrar", async () => {
    const insertadas = await escribirConContexto(
      CONTEXTO_OWNER1,
      `insert into public.audit_log (org_id, action, entity)
       values ($1, 'test.insert', 'test')`,
      [ORG1],
    )
    expect(insertadas).toBe(1)

    const modificadas = await escribirConContexto(
      CONTEXTO_OWNER1,
      `update public.audit_log set action = 'test.update' where org_id = $1`,
      [ORG1],
    )
    expect(modificadas).toBe(0)

    const borradas = await escribirConContexto(
      CONTEXTO_OWNER1,
      `delete from public.audit_log where org_id = $1`,
      [ORG1],
    )
    expect(borradas).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Segunda prueba de fuego: FORCE RLS tambien somete al propietario
// ---------------------------------------------------------------------------

describe("propietario (camarero_owner)", () => {
  it("debe seguir sujeto a la RLS por FORCE: con org de contexto solo ve esa org", async () => {
    if (entorno === undefined) {
      throw new Error("El entorno de pruebas no esta levantado")
    }
    const cliente = await conectar(entorno.parametros.owner)
    try {
      await cliente.query("begin")
      await aplicarContexto(cliente, { orgId: ORG1, staffId: STAFF_OWNER1, role: "org_owner" })
      const resultado = await cliente.query<{ n: number }>(
        "select count(*)::int as n from public.orgs",
      )
      await cliente.query("rollback")
      // Es propietario de la tabla, pero FORCE lo somete a la politica: con org de
      // contexto ve 1, no las 2. Sin FORCE veria 2 (comprobado a mano, ver informe).
      expect(resultado.rows[0]?.n).toBe(1)
    } finally {
      await cerrar(cliente)
    }
  })
})

// ---------------------------------------------------------------------------
// Utilidad: consulta directa sin contexto (metadatos, catalogo)
// ---------------------------------------------------------------------------

async function conectarYConsultar<T extends QueryResultRow>(
  parametros: ParametrosConexion,
  sql: string,
): Promise<T[]> {
  const cliente = await conectar(parametros)
  try {
    const resultado = await cliente.query<T>(sql)
    return resultado.rows
  } finally {
    await cerrar(cliente)
  }
}
