/**
 * El reparto de la comanda por puesto del local, contra la base real (TASK-F1-09).
 *
 * Los puestos son datos del local. El puesto real de un plato es el suyo, si lo trae; el de su
 * categoria, si no; y el por defecto del local como ultimo recurso. Se comprueban: el reparto
 * al enviar por el puesto REAL, que la categoria manda y el plato anula, el auto-aceptado como
 * PROPIEDAD del puesto (y su contraste), el plato sin destino, que el disparador sigue
 * mordiendo y el aislamiento entre locales.
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
const CAT_BEBIDAS = "05000000-0000-0000-0000-000000000001"
const CAT_PRINCIPALES = "05000000-0000-0000-0000-000000000002"
const CAT_SINDESTINO = "05000000-0000-0000-0000-000000000003"
const ITEM_AGUA = "04000000-0000-0000-0000-000000000001" // categoria con Barra (auto)
const ITEM_PASTEL = "04000000-0000-0000-0000-000000000002" // hereda Caliente (no auto)
const ITEM_LOMO = "04000000-0000-0000-0000-000000000003" // anula a Frio
const ITEM_PAN = "04000000-0000-0000-0000-000000000004" // sin categoria ni puesto -> defecto
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
const DUENO_A: Contexto = { orgId: ORG1, staffId: STAFF_A, role: "org_owner" }
const CAMARERO_B: Contexto = { orgId: ORG2, staffId: STAFF_B, role: "server" }

let entorno: EntornoDePruebas | undefined
let app: ClientePostgres | undefined
const PUESTOS_A = { cocina: "", frio: "", caliente: "", barra: "" }

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

async function puestosDe(
  cliente: ClientePostgres,
  local: string,
  nombres: string[],
): Promise<string> {
  const resultado = await cliente.query<{ id: string }>(
    `select id from public.kitchen_stations
      where location_id = $1 and name = any($2::text[]) order by sort_order`,
    [local, nombres],
  )
  return resultado.rows[0]?.id ?? ""
}

/**
 * Crea una comanda por puesto, como el borde: el nombre del puesto congelado, su identificador
 * y una linea por plato. La clave de idempotencia se deriva del puesto.
 */
async function enviarAPuesto(
  cliente: ClientePostgres,
  clave: string,
  sesionId: string,
  puestoNombre: string,
  puestoId: string,
  item: string,
  qty: number,
): Promise<string> {
  const clavePuesto = `${clave}.${puestoNombre}`
  await cliente.query(
    `insert into public.orders
       (org_id, location_id, session_id, source, prep_station, prep_station_id, idempotency_key)
     values ($1, $2, $3, 'table', $4, $5::uuid, $6)`,
    [ORG1, LOC_A, sesionId, puestoNombre, puestoId, clavePuesto],
  )
  const orden = await cliente.query<{ id: string }>(
    "select id from public.orders where idempotency_key = $1",
    [clavePuesto],
  )
  const id = orden.rows[0]?.id
  if (id === undefined) {
    throw new Error(`No se creo la comanda ${clavePuesto}`)
  }
  await cliente.query(
    "insert into public.order_items (order_id, menu_item_id, qty) values ($1, $2, $3)",
    [id, item, qty],
  )
  return id
}

async function leerOrden(
  cliente: ClientePostgres,
  id: string,
): Promise<{ status: string; subtotal_clp: number } | undefined> {
  const resultado = await cliente.query<{ status: string; subtotal_clp: number }>(
    "select status, subtotal_clp from public.orders where id = $1",
    [id],
  )
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

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_ACTIVA}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-ACTIVA', 'active'),
        ('${SES_B}', '${ORG2}', '${LOC_B}', '${MESA_B1}', 'MESA-B-ACTIVA', 'active');
    `)
    // La categoria trae el puesto; el plato puede anularlo. Los puestos ya existen: los creo
    // el disparador de `locations` al insertar el local.
    await cliente.query(
      `insert into public.menu_categories (id, location_id, name_i18n, prep_station_id)
       select $1, $2, '{"es":"Bebidas"}'::jsonb, id
         from public.kitchen_stations where location_id = $2 and name = 'Barra'`,
      [CAT_BEBIDAS, LOC_A],
    )
    await cliente.query(
      `insert into public.menu_categories (id, location_id, name_i18n, prep_station_id)
       select $1, $2, '{"es":"Principales"}'::jsonb, id
         from public.kitchen_stations where location_id = $2 and name = 'Caliente'`,
      [CAT_PRINCIPALES, LOC_A],
    )
    await cliente.query(
      `insert into public.menu_categories (id, location_id, name_i18n, prep_station_id)
       values ($1, $2, '{"es":"Sin puesto"}'::jsonb, null)`,
      [CAT_SINDESTINO, LOC_A],
    )
    await cliente.query(
      `insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp)
       values ($1, $2, $3, '{"es":"Agua"}', 2000),
              ($4, $2, $5, '{"es":"Pastel"}', 3000),
              ($6, $2, $7, '{"es":"Pan"}', 1000)`,
      [ITEM_AGUA, LOC_A, CAT_BEBIDAS, ITEM_PASTEL, CAT_PRINCIPALES, ITEM_PAN, CAT_SINDESTINO],
    )
    // El lomo anula el Caliente de su categoria y va a Frio.
    await cliente.query(
      `insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, prep_station_id)
       select $1, $2, $3, '{"es":"Lomo"}'::jsonb, 9000, id
         from public.kitchen_stations where location_id = $2 and name = 'Frío'`,
      [ITEM_LOMO, LOC_A, CAT_PRINCIPALES],
    )
    PUESTOS_A.cocina = await puestosDe(cliente, LOC_A, ["Cocina"])
    PUESTOS_A.frio = await puestosDe(cliente, LOC_A, ["Frío"])
    PUESTOS_A.caliente = await puestosDe(cliente, LOC_A, ["Caliente"])
    PUESTOS_A.barra = await puestosDe(cliente, LOC_A, ["Barra"])
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

describe("El puesto real de un plato", () => {
  it("debe heredar el de la categoria cuando el plato no trae", async () => {
    const puesto = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const resultado = await cliente.query<{ id: string }>(
        "select public.camarero_estacion_de_plato($1) as id",
        [ITEM_AGUA],
      )
      return resultado.rows[0]?.id
    })
    expect(puesto).toBe(PUESTOS_A.barra)
  })

  it("debe preferir el del plato cuando lo trae (anula la categoria)", async () => {
    const puesto = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const resultado = await cliente.query<{ id: string }>(
        "select public.camarero_estacion_de_plato($1) as id",
        [ITEM_LOMO],
      )
      return resultado.rows[0]?.id
    })
    expect(puesto).toBe(PUESTOS_A.frio)
  })

  it("debe caer al puesto por defecto del local cuando no le llega ninguno", async () => {
    const puesto = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const resultado = await cliente.query<{ id: string }>(
        "select public.camarero_estacion_de_plato($1) as id",
        [ITEM_PAN],
      )
      return resultado.rows[0]?.id
    })
    expect(puesto).toBe(PUESTOS_A.cocina)
  })
})

describe("El auto-aceptado es una propiedad del puesto", () => {
  it("debe nacer aceptada la comanda de un puesto auto-aceptado y cerrar sus importes", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const id = await enviarAPuesto(
        cliente,
        "auto-si",
        SES_ACTIVA,
        "Barra",
        PUESTOS_A.barra,
        ITEM_AGUA,
        2,
      )
      await cliente.query("update public.orders set status = 'aceptada' where id = $1", [id])
      return await leerOrden(cliente, id)
    })
    expect(resultado?.status).toBe("aceptada")
    // 2000 x 2 = 4000: los importes se cerraron al nacer aceptada.
    expect(resultado?.subtotal_clp).toBe(4000)
  })

  it("no debe dejar al comensal aceptar la comanda de un puesto que espera aprobacion", async () => {
    const afectadas = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const id = await enviarAPuesto(
        cliente,
        "auto-no",
        SES_ACTIVA,
        "Caliente",
        PUESTOS_A.caliente,
        ITEM_PASTEL,
        1,
      )
      const resultado = await cliente.query(
        "update public.orders set status = 'aceptada' where id = $1",
        [id],
      )
      return resultado.rowCount ?? 0
    })
    expect(afectadas).toBe(0)
  })

  it("debe cambiar el comportamiento solo cambiando la propiedad del puesto", async () => {
    const resultado = await enUnaTransaccion(async (cliente, como) => {
      await como(DUENO_A)
      // El dueno marca Caliente como auto-aceptado: ya no queda en el codigo.
      await cliente.query("update public.kitchen_stations set auto_accept = true where id = $1", [
        PUESTOS_A.caliente,
      ])
      await como(COMENSAL_A)
      const id = await enviarAPuesto(
        cliente,
        "auto-cambio",
        SES_ACTIVA,
        "Caliente",
        PUESTOS_A.caliente,
        ITEM_PASTEL,
        1,
      )
      await cliente.query("update public.orders set status = 'aceptada' where id = $1", [id])
      return await leerOrden(cliente, id)
    })
    expect(resultado?.status).toBe("aceptada")
  })
})

describe("El disparador sigue mordiendo", () => {
  it("no debe dejar una linea cuyo puesto real no es el de la comanda", async () => {
    const fallo = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      try {
        // El pan resuelve al puesto por defecto (Cocina), pero la comanda dice Barra.
        await enviarAPuesto(cliente, "mal", SES_ACTIVA, "Barra", PUESTOS_A.barra, ITEM_PAN, 1)
        return false
      } catch {
        return true
      }
    })
    expect(fallo).toBe(true)
  })

  it("debe aceptar la linea cuando el puesto real coincide", async () => {
    const estado = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      await enviarAPuesto(cliente, "bien", SES_ACTIVA, "Frío", PUESTOS_A.frio, ITEM_LOMO, 1)
      return await contar(cliente, "from public.orders where idempotency_key = $1", ["bien.Frío"])
    })
    expect(estado).toBe(1)
  })
})

describe("Aislamiento entre locales", () => {
  it("no debe ver las comandas ni el otro local", async () => {
    const visto = await enUnaTransaccion(async (cliente, como) => {
      await como(COMENSAL_A)
      const id = await enviarAPuesto(
        cliente,
        "aislado",
        SES_ACTIVA,
        "Barra",
        PUESTOS_A.barra,
        ITEM_AGUA,
        1,
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
