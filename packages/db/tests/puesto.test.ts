/**
 * El reparto de la comanda por puesto, contra la base real.
 *
 * Una cesta con un plato y una bebida produce DOS comandas, una por destino, con claves de
 * idempotencia derivadas. La de barra nace aceptada y con sus importes cerrados; la de cocina
 * espera aprobacion humana. Se comprueban tambien la idempotencia con dos destinos, que la
 * linea tiene que pertenecer a su destino y el aislamiento entre locales.
 *
 * Se conectan como `camarero_app` (nunca el propietario: LL-004). Cada prueba corre en una
 * transaccion que se revierte.
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
const SES_B = "f0000000-0000-0000-0000-000000000004"
const PLATO = "04000000-0000-0000-0000-000000000001" // "Lomo", 3000 CLP, caliente
const BEBIDA = "04000000-0000-0000-0000-000000000002" // "Agua", 2000 CLP, bebidas
const SIN_ESTACION = "04000000-0000-0000-0000-000000000003" // "Pan", 1000 CLP, sin estacion
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"

type Contexto = {
  readonly orgId?: string
  readonly staffId?: string
  readonly role?: string
  readonly sessionId?: string
}

const COMENSAL_A: Contexto = { sessionId: SES_ACTIVA }
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
 * Crea una comanda por destino, como el borde: clave derivada `${clave}.${destino}`, una linea
 * por plato y, si el destino es automatico, el UPDATE que la deja aceptada y cierra importes.
 */
async function enviarPorDestino(
  cliente: ClientePostgres,
  clave: string,
  sesionId: string,
  destino: string,
  item: string,
  qty: number,
  automatico: boolean,
): Promise<string> {
  const claveDestino = `${clave}.${destino}`
  await cliente.query(
    `insert into public.orders
       (org_id, location_id, session_id, source, prep_station, idempotency_key)
     values ($1, $2, $3, 'table', $4, $5)`,
    [ORG1, LOC_A, sesionId, destino, claveDestino],
  )
  const orden = await cliente.query<{ id: string }>(
    "select id from public.orders where idempotency_key = $1",
    [claveDestino],
  )
  const id = orden.rows[0]?.id
  if (id === undefined) {
    throw new Error(`No se creo la comanda ${claveDestino}`)
  }
  await cliente.query(
    "insert into public.order_items (order_id, menu_item_id, qty) values ($1, $2, $3)",
    [id, item, qty],
  )
  if (automatico) {
    await cliente.query("update public.orders set status = 'aceptada' where id = $1", [id])
  }
  return id
}

async function leerOrden(
  cliente: ClientePostgres,
  id: string,
): Promise<{ status: string; subtotal_clp: number; total_clp: number } | undefined> {
  const resultado = await cliente.query<{
    status: string
    subtotal_clp: number
    total_clp: number
  }>("select status, subtotal_clp, total_clp from public.orders where id = $1", [id])
  return resultado.rows[0]
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

      insert into public.menu_items (id, location_id, name_i18n, price_clp, prep_station, active, available) values
        ('${PLATO}', '${LOC_A}', '{"es":"Lomo"}', 3000, 'caliente', true, true),
        ('${BEBIDA}', '${LOC_A}', '{"es":"Agua"}', 2000, 'bebidas', true, true),
        ('${SIN_ESTACION}', '${LOC_A}', '{"es":"Pan"}', 1000, null, true, true);

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_ACTIVA}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-ACTIVA', 'active'),
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

describe("Una cesta con un plato y una bebida", () => {
  it("debe producir dos comandas: la de cocina espera y la de barra nace aceptada", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const cocina = await enviarPorDestino(
        cliente,
        "envio-1",
        SES_ACTIVA,
        "caliente",
        PLATO,
        1,
        false,
      )
      const barra = await enviarPorDestino(
        cliente,
        "envio-1",
        SES_ACTIVA,
        "bebidas",
        BEBIDA,
        2,
        true,
      )
      const comandas = await contar(cliente, "from public.orders where session_id = $1", [
        SES_ACTIVA,
      ])
      return {
        cocina: await leerOrden(cliente, cocina),
        barra: await leerOrden(cliente, barra),
        comandas,
      }
    })

    expect(resultado.comandas).toBe(2)
    expect(resultado.cocina?.status).toBe("pendiente")
    expect(resultado.cocina?.subtotal_clp).toBe(0)
    expect(resultado.barra?.status).toBe("aceptada")
    // 2000 x 2 = 4000: los importes se cerraron al nacer aceptada.
    expect(resultado.barra?.subtotal_clp).toBe(4000)
    expect(resultado.barra?.total_clp).toBe(4000)
  })

  it("debe mandar a cocina un plato sin estacion", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const id = await enviarPorDestino(
        cliente,
        "envio-sin",
        SES_ACTIVA,
        "cocina",
        SIN_ESTACION,
        1,
        false,
      )
      const destino = await cliente.query<{ prep_station: string }>(
        "select prep_station from public.orders where id = $1",
        [id],
      )
      return destino.rows[0]?.prep_station
    })
    expect(resultado).toBe("cocina")
  })
})

describe("Reparto entre las pantallas de puesto", () => {
  it("la cocina ve el plato y no la bebida; la barra ve la bebida", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      await enviarPorDestino(cliente, "envio-filtro", SES_ACTIVA, "caliente", PLATO, 1, false)
      await enviarPorDestino(cliente, "envio-filtro", SES_ACTIVA, "bebidas", BEBIDA, 1, true)
      await como(CAMARERO_A)
      const filtro =
        "from public.orders o where o.status <> 'cerrada' and o.prep_station = any($1::text[])"
      return {
        cocina: await contar(cliente, filtro, [["frio", "caliente", "postre", "cocina"]]),
        barra: await contar(cliente, filtro, [["bar", "bebidas"]]),
      }
    })
    expect(resultado.cocina).toBe(1)
    expect(resultado.barra).toBe(1)
  })
})

describe("Idempotencia con dos destinos", () => {
  it("no debe crear comandas hermanas nuevas al reenviar la misma clave", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      await enviarPorDestino(cliente, "envio-2", SES_ACTIVA, "caliente", PLATO, 1, false)
      await enviarPorDestino(cliente, "envio-2", SES_ACTIVA, "bebidas", BEBIDA, 1, true)
      await cliente.query("savepoint segundo")
      let fallo = false
      try {
        await enviarPorDestino(cliente, "envio-2", SES_ACTIVA, "caliente", PLATO, 1, false)
      } catch {
        fallo = true
        await cliente.query("rollback to savepoint segundo")
      }
      return {
        fallo,
        comandas: await contar(cliente, "from public.orders where session_id = $1", [SES_ACTIVA]),
      }
    })
    expect(resultado.fallo).toBe(true)
    expect(resultado.comandas).toBe(2)
  })
})

describe("El destino es una copia fiable", () => {
  it("no debe dejar una linea de cocina en una comanda de barra", async () => {
    const fallo = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      try {
        await enviarPorDestino(cliente, "envio-mal", SES_ACTIVA, "bar", PLATO, 1, true)
        return false
      } catch {
        return true
      }
    })
    expect(fallo).toBe(true)
  })

  it("no debe dejar al comensal aceptar una comanda de cocina", async () => {
    const afectadas = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const id = await enviarPorDestino(
        cliente,
        "envio-kitchen",
        SES_ACTIVA,
        "caliente",
        PLATO,
        1,
        false,
      )
      const resultado = await cliente.query(
        "update public.orders set status = 'aceptada' where id = $1",
        [id],
      )
      return resultado.rowCount ?? 0
    })
    expect(afectadas).toBe(0)
  })
})

describe("Aislamiento por destino", () => {
  it("no debe ver las comandas un empleado de otro local", async () => {
    const visto = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const id = await enviarPorDestino(
        cliente,
        "envio-aislado",
        SES_ACTIVA,
        "bebidas",
        BEBIDA,
        1,
        true,
      )
      await como(CAMARERO_B)
      const localB = await contar(cliente, "from public.orders where id = $1", [id])
      await como(CAMARERO_A)
      const localA = await contar(cliente, "from public.orders where id = $1", [id])
      return { localB, localA }
    })
    expect(visto.localB).toBe(0)
    expect(visto.localA).toBe(1)
  })
})
