/**
 * La comanda de punta a punta, contra la base real: idempotencia, barrera de aprobacion,
 * precio fijado por la carta y aislamiento entre locales y sesiones.
 *
 * Se conectan como `camarero_app` (nunca el propietario: LL-004). Cada prueba corre en una
 * transaccion que se revierte, cambiando de contexto entre el comensal y el camarero cuando
 * el guion lo necesita. El sembrado lo hace `camarero_admin`, que si puede saltar la RLS.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_B = "bbbbbbbb-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_B1 = "e0000000-0000-0000-0000-000000000002"
const SES_ACTIVA = "f0000000-0000-0000-0000-000000000001"
const SES_PAIRING = "f0000000-0000-0000-0000-000000000002"
const SES_B = "f0000000-0000-0000-0000-000000000004"
const ITEM_A = "04000000-0000-0000-0000-000000000001" // "Empanada A", 1500 CLP
const ITEM_B = "04000000-0000-0000-0000-000000000002" // "Empanada B", 1500 CLP
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"

type Contexto = {
  readonly orgId?: string
  readonly staffId?: string
  readonly role?: string
  readonly sessionId?: string
}

const COMENSAL_A: Contexto = { sessionId: SES_ACTIVA }
const COMENSAL_B: Contexto = { sessionId: SES_B }
const COMENSAL_SIN_APROBAR: Contexto = { sessionId: SES_PAIRING }
const CAMARERO_A: Contexto = { orgId: ORG1, staffId: STAFF_A, role: "server" }
const CAMARERO_B: Contexto = { orgId: ORG2, staffId: STAFF_B, role: "server" }

let entorno: EntornoDePruebas | undefined
let app: ClientePostgres | undefined

function clienteApp(): ClientePostgres {
  if (app === undefined) {
    throw new Error("El cliente de aplicacion no esta conectado")
  }
  return app
}

async function aplicarContexto(cliente: ClientePostgres, contexto: Contexto): Promise<void> {
  const pares: ReadonlyArray<readonly [string, string]> = [
    ["app.org_id", contexto.orgId ?? ""],
    ["app.staff_id", contexto.staffId ?? ""],
    ["app.role", contexto.role ?? ""],
    ["app.location_id", ""],
    ["app.session_id", contexto.sessionId ?? ""],
    ["app.table_code", ""],
    ["app.table_id", ""],
  ]
  for (const [clave, valor] of pares) {
    await cliente.query("select set_config($1, $2, true)", [clave, valor])
  }
}

/**
 * Ejecuta un guion dentro de una transaccion que se revierte, con un helper para cambiar de
 * contexto sobre la marcha (comensal que pide, camarero que acepta).
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

/**
 * Crea una comanda como el borde: inserta la cabecera con su clave de idempotencia y una
 * linea por `menu_item_id` y cantidad. No envia precios: los fija la base desde la carta.
 */
async function enviarComanda(
  cliente: ClientePostgres,
  clave: string,
  sesionId: string,
  item: string,
  qty = 2,
): Promise<string> {
  await cliente.query(
    `insert into public.orders (org_id, location_id, session_id, source, idempotency_key)
     values ($1, $2, $3, 'table', $4)`,
    [ORG1, LOC_A, sesionId, clave],
  )
  const orden = await cliente.query<{ id: string }>(
    "select id from public.orders where idempotency_key = $1",
    [clave],
  )
  const id = orden.rows[0]?.id
  if (id === undefined) {
    throw new Error(`No se creo la comanda ${clave}`)
  }
  await cliente.query(
    `insert into public.order_items (order_id, menu_item_id, qty) values ($1, $2, $3)`,
    [id, item, qty],
  )
  return id
}

async function contar(cliente: ClientePostgres, sql: string, valores: unknown[]): Promise<number> {
  const resultado = await cliente.query<{ n: number }>(`select count(*)::int as n ${sql}`, valores)
  return resultado.rows[0]?.n ?? -1
}

async function sembrar(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values
        ('${ORG1}', 'Organizacion Uno'),
        ('${ORG2}', 'Organizacion Dos');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'active'),
        ('${LOC_B}', '${ORG2}', 'local-b', 'Local B', 'active');

      insert into public.tables (id, location_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'Mesa A1', 'ABCDEFGH'),
        ('${MESA_B1}', '${LOC_B}', 'Mesa B1', 'ABCDEFGJ');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_A}', '${ORG1}', '${LOC_A}', 'serverA@camarero.test', 'server', 'Camarero A'),
        ('${STAFF_B}', '${ORG2}', '${LOC_B}', 'serverB@camarero.test', 'server', 'Camarero B');

      insert into public.menu_categories (id, location_id, name_i18n) values
        ('03000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Entrantes A"}'),
        ('03000000-0000-0000-0000-000000000002', '${LOC_B}', '{"es":"Entrantes B"}');

      insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, active, available) values
        ('${ITEM_A}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Empanada A"}', 1500, true, true),
        ('${ITEM_B}', '${LOC_B}', '03000000-0000-0000-0000-000000000002', '{"es":"Empanada B"}', 1500, true, true);

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_ACTIVA}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-ACTIVA', 'active'),
        ('${SES_PAIRING}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-PAIR', 'pairing'),
        ('${SES_B}', '${ORG2}', '${LOC_B}', '${MESA_B1}', 'MESA-B-ACTIVA', 'active');
    `)
  } finally {
    await cerrar(cliente)
  }
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrar(entorno.parametros.admin)
  app = await conectar(entorno.parametros.app)
}, 240_000)

afterAll(async () => {
  await cerrar(app)
  entorno?.detener()
})

// ---------------------------------------------------------------------------
// Idempotencia: dos envios identicos, una sola comanda
// ---------------------------------------------------------------------------

describe("Idempotencia del envio", () => {
  it("debe impedir una segunda comanda con la misma clave y dejar solo una", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      await enviarComanda(cliente, "idem-doble", SES_ACTIVA, ITEM_A)
      const antes = await contar(cliente, "from public.orders where idempotency_key = $1", [
        "idem-doble",
      ])

      // El segundo envio, identico, choca con la clave unica global.
      await cliente.query("savepoint segundo")
      let fallo = false
      try {
        await enviarComanda(cliente, "idem-doble", SES_ACTIVA, ITEM_A)
      } catch {
        fallo = true
        await cliente.query("rollback to savepoint segundo")
      }
      const despues = await contar(cliente, "from public.orders where idempotency_key = $1", [
        "idem-doble",
      ])
      return { antes, fallo, despues }
    })

    expect(resultado.antes).toBe(1)
    expect(resultado.fallo).toBe(true)
    expect(resultado.despues).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Barrera de aprobacion: sin aprobacion no se crea la comanda
// ---------------------------------------------------------------------------

describe("Barrera de aprobacion", () => {
  it("no debe crear la comanda con una sesion sin aprobar", async () => {
    const fallo = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_SIN_APROBAR)
      try {
        await enviarComanda(cliente, "idem-sin-aprobar", SES_PAIRING, ITEM_A)
        return false
      } catch {
        return true
      }
    })
    expect(fallo).toBe(true)
  })

  it("si debe crear la comanda con la sesion aprobada (contraste)", async () => {
    const id = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      return enviarComanda(cliente, "idem-aprobada", SES_ACTIVA, ITEM_A)
    })
    expect(id).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// El precio lo fija la base, no el cliente
// ---------------------------------------------------------------------------

describe("El precio lo fija la base", () => {
  it("debe ignorar el precio inventado y cerrar la cuenta con el valor de la carta", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      // La cookie manipulada solo puede mandar plato y cantidad; el atacante inventa el
      // precio por si la base lo aceptara. La carta dice 1500.
      await cliente.query(
        `insert into public.orders (org_id, location_id, session_id, source, idempotency_key)
         values ($1, $2, $3, 'table', 'idem-precio')`,
        [ORG1, LOC_A, SES_ACTIVA],
      )
      const orden = await cliente.query<{ id: string }>(
        "select id from public.orders where idempotency_key = 'idem-precio'",
      )
      const id = orden.rows[0]?.id ?? ""
      const linea = await cliente.query<{
        unit_price_clp: number
        name_snapshot: string
        line_total_clp: number
      }>(
        `insert into public.order_items
           (order_id, menu_item_id, name_snapshot, unit_price_clp, qty, line_total_clp)
         values ($1, $2, 'Inventado', 1, 2, 2)
         returning unit_price_clp, name_snapshot, line_total_clp`,
        [id, ITEM_A],
      )
      // El camarero la acepta: ahi se cierran los importes.
      await como(CAMARERO_A)
      await cliente.query("update public.orders set status = 'aceptada' where id = $1", [id])
      const comanda = await cliente.query<{
        status: string
        subtotal_clp: number
        total_clp: number
      }>("select status, subtotal_clp, total_clp from public.orders where id = $1", [id])
      return { linea: linea.rows[0], comanda: comanda.rows[0] }
    })

    expect(resultado.linea?.unit_price_clp).toBe(1500)
    expect(resultado.linea?.name_snapshot).toBe("Empanada A")
    expect(resultado.linea?.line_total_clp).toBe(3000)
    expect(resultado.comanda?.status).toBe("aceptada")
    expect(resultado.comanda?.subtotal_clp).toBe(3000)
    expect(resultado.comanda?.total_clp).toBe(3000)
  })

  it("no debe dejar pedir un plato de otro local", async () => {
    const fallo = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      await cliente.query(
        `insert into public.orders (org_id, location_id, session_id, source, idempotency_key)
         values ($1, $2, $3, 'table', 'idem-ajeno')`,
        [ORG1, LOC_A, SES_ACTIVA],
      )
      const orden = await cliente.query<{ id: string }>(
        "select id from public.orders where idempotency_key = 'idem-ajeno'",
      )
      try {
        await cliente.query(
          `insert into public.order_items (order_id, menu_item_id, qty) values ($1, $2, 1)`,
          [orden.rows[0]?.id ?? "", ITEM_B],
        )
        return false
      } catch {
        return true
      }
    })
    expect(fallo).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Aislamiento: otra sesion y otro local no ven la comanda
// ---------------------------------------------------------------------------

describe("Aislamiento de la comanda", () => {
  it("no debe verla un comensal de otra sesion ni un empleado de otro local, y si el suyo", async () => {
    const visto = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const orden = await enviarComanda(cliente, "idem-aislamiento", SES_ACTIVA, ITEM_A)

      await como(COMENSAL_B)
      const comensalB = await contar(cliente, "from public.orders where id = $1", [orden])

      await como(CAMARERO_B)
      const localB = await contar(cliente, "from public.orders where id = $1", [orden])

      await como(CAMARERO_A)
      const localA = await contar(cliente, "from public.orders where id = $1", [orden])

      return { comensalB, localB, localA }
    })

    expect(visto.comensalB).toBe(0)
    expect(visto.localB).toBe(0)
    expect(visto.localA).toBe(1)
  })
})
