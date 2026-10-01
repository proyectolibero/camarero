/**
 * La sala contra la base real: aprobar desde un puesto abre la mesa, y el aislamiento entre
 * locales se sostiene (TASK-F1-08, D-053).
 *
 * Es la prueba que el worker no puede hacer con un almacen inyectado: demuestra que, tras
 * aprobar el emparejamiento por la puerta unica `camarero_decidir_emparejamiento`, la sesion
 * queda `active` y el comensal PUEDE crear su comanda; y que antes de aprobar NO puede. Ademas
 * comprueba que un empleado de otro local ni ve la solicitud ni la aprueba, ni ve las mesas
 * ajenas. Se ejecuta como `camarero_app` (sin BYPASSRLS, LL-004) dentro de transacciones que
 * se revierten.
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
const SES_A = "f0000000-0000-0000-0000-000000000001"
const SES_B = "f0000000-0000-0000-0000-000000000002"
const PR_A = "10000000-0000-0000-0000-000000000001"
const PR_B = "10000000-0000-0000-0000-000000000002"
const ITEM_A = "04000000-0000-0000-0000-000000000001"
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"

type Contexto = {
  readonly tableCode?: string
  readonly tableId?: string
  readonly locationId?: string
  readonly sessionId?: string
  readonly orgId?: string
  readonly staffId?: string
  readonly role?: string
}

const CAMARERO_A: Contexto = { orgId: ORG1, staffId: STAFF_A, role: "server" }
const CAMARERO_B: Contexto = { orgId: ORG2, staffId: STAFF_B, role: "server" }
const COMENSAL_A: Contexto = { sessionId: SES_A }

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
    ["app.location_id", contexto.locationId ?? ""],
    ["app.session_id", contexto.sessionId ?? ""],
    ["app.table_code", contexto.tableCode ?? ""],
    ["app.table_id", contexto.tableId ?? ""],
  ]
  for (const [clave, valor] of pares) {
    await cliente.query("select set_config($1, $2, true)", [clave, valor])
  }
}

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

async function contar(cliente: ClientePostgres, sql: string, valores: unknown[]): Promise<number> {
  const resultado = await cliente.query<{ n: number }>(`select count(*)::int as n ${sql}`, valores)
  return resultado.rows[0]?.n ?? -1
}

/** La puerta unica de la decision, tal cual la llama el panel. */
async function decidir(cliente: ClientePostgres, solicitudId: string): Promise<string | undefined> {
  const resultado = await cliente.query<{ causa: string }>(
    "select public.camarero_decidir_emparejamiento($1, 'approved', null) as causa",
    [solicitudId],
  )
  return resultado.rows[0]?.causa
}

async function estadoDeSesion(
  cliente: ClientePostgres,
  sesionId: string,
): Promise<string | undefined> {
  const resultado = await cliente.query<{ state: string }>(
    "select state from public.table_sessions where id = $1",
    [sesionId],
  )
  return resultado.rows[0]?.state
}

/**
 * Lo mismo que hace el comensal al enviar su cesta: crear una comanda de mesa. Se aisla en un
 * savepoint porque la RLS puede rechazarla con un error; asi la transaccion sigue viva para
 * poder aprobar despues en el mismo guion.
 */
async function intentarInsertarComanda(
  cliente: ClientePostgres,
  sesionId: string,
): Promise<number> {
  await cliente.query("savepoint intento_comanda")
  try {
    const resultado = await cliente.query(
      `insert into public.orders
         (org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key)
       values ($1, $2, $3, 'table', 'pendiente', 1000, 1000, $4)`,
      [ORG1, LOC_A, sesionId, `idem-${sesionId}`],
    )
    await cliente.query("release savepoint intento_comanda")
    return resultado.rowCount ?? 0
  } catch {
    await cliente.query("rollback to savepoint intento_comanda")
    return 0
  }
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

      insert into public.menu_items (id, location_id, name_i18n, price_clp, prep_station, active, available) values
        ('${ITEM_A}', '${LOC_A}', '{"es":"Empanada A"}', 1500, 'caliente', true, true);

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state, pairing_expires_at) values
        ('${SES_A}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-PAIR', 'pairing', now() + public.camarero_ventana_de_emparejamiento()),
        ('${SES_B}', '${ORG2}', '${LOC_B}', '${MESA_B1}', 'MESA-B-PAIR', 'pairing', now() + public.camarero_ventana_de_emparejamiento());

      insert into public.pairing_requests (id, session_id, table_id, state) values
        ('${PR_A}', '${SES_A}', '${MESA_A1}', 'pending'),
        ('${PR_B}', '${SES_B}', '${MESA_B1}', 'pending');
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

describe("Aprobar abre la mesa: el comensal pasa de no poder pedir a poder pedir", () => {
  it("debe quedar la sesion activa y permitir la comanda solo despues de aprobar", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      // Antes de aprobar: la barrera de base impide la comanda y la sesion sigue en pairing.
      await como(COMENSAL_A)
      const antes = await intentarInsertarComanda(cliente, SES_A)
      const estadoAntes = await estadoDeSesion(cliente, SES_A)

      // El empleado del local aprueba por la puerta unica (lo mismo que hace el panel).
      await como(CAMARERO_A)
      const causa = await decidir(cliente, PR_A)
      const estadoDespues = await estadoDeSesion(cliente, SES_A)

      // Ahora el comensal SI puede pedir.
      await como(COMENSAL_A)
      const despues = await intentarInsertarComanda(cliente, SES_A)

      return { antes, estadoAntes, causa, estadoDespues, despues }
    })

    expect({ antes: resultado.antes, estadoAntes: resultado.estadoAntes }).toEqual({
      antes: 0,
      estadoAntes: "pairing",
    })
    expect(resultado.causa).toBe("ok")
    expect(resultado.estadoDespues).toBe("active")
    expect(resultado.despues).toBe(1)
  })
})

describe("Aislamiento entre locales: la sala ajena no existe", () => {
  it("un empleado de otro local no debe ver ni aprobar la solicitud", async () => {
    const visto = await enUnaTransaccion(async (cliente, como) => {
      await como(CAMARERO_B)
      const veLaSolicitud = await contar(cliente, "from public.pairing_requests where id = $1", [
        PR_A,
      ])
      const causaAjena = await decidir(cliente, PR_A)

      await como(CAMARERO_A)
      // El intento ajeno no cambio nada: la sesion sigue en pairing y A la ve.
      const estadoTrasElIntento = await estadoDeSesion(cliente, SES_A)
      const veAjeno = await contar(cliente, "from public.pairing_requests where id = $1", [PR_A])
      const causaPropia = await decidir(cliente, PR_A)

      return { veLaSolicitud, causaAjena, estadoTrasElIntento, veAjeno, causaPropia }
    })

    expect(visto.veLaSolicitud).toBe(0)
    expect(visto.causaAjena).toBe("otro_local")
    expect(visto.estadoTrasElIntento).toBe("pairing")
    // La prueba no es vacua: el del mismo local si la ve y si la aprueba.
    expect(visto.veAjeno).toBe(1)
    expect(visto.causaPropia).toBe("ok")
  })

  it("un empleado de otro local no debe ver las mesas del local ajeno", async () => {
    const visto = await enUnaTransaccion(async (cliente, como) => {
      await como(CAMARERO_B)
      const mesasAjenas = await contar(cliente, "from public.tables where location_id = $1", [
        LOC_A,
      ])
      await como(CAMARERO_A)
      const mesasPropias = await contar(cliente, "from public.tables where location_id = $1", [
        LOC_A,
      ])
      return { mesasAjenas, mesasPropias }
    })
    expect(visto.mesasAjenas).toBe(0)
    expect(visto.mesasPropias).toBe(1)
  })
})
