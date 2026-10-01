/**
 * El camino del comensal anonimo: las dos cerraduras minimas y la barrera de aprobacion.
 *
 * Cada prueba intenta lo que NO debe poder hacer un comensal, ademas del caso que si debe
 * funcionar, para que la cerradura no pase por vacia. Se ejecuta SIEMPRE como
 * `camarero_app` (no propietario y sin BYPASSRLS) y con el contexto `app.*` fijado dentro de
 * una transaccion que se revierte: conectar como el propietario daria verde sin probar nada
 * (LL-004). El sembrado lo hace `camarero_admin`, que si puede saltar la RLS.
 */

import { randomUUID } from "node:crypto"
import type { QueryResultRow } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_B = "bbbbbbbb-0000-0000-0000-000000000001"
const LOC_DRAFT = "aaaaaaaa-0000-0000-0000-000000000009"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_B1 = "e0000000-0000-0000-0000-000000000002"
const MESA_DRAFT = "e0000000-0000-0000-0000-000000000009"
const CODIGO_A = "ABCDEFGH"
const CODIGO_B = "ABCDEFGJ"
const CODIGO_DRAFT = "ABCDEFGZ"
const CODIGO_INVENTADO = "ZZZZZZZZ"

const SES_ACTIVA = "f0000000-0000-0000-0000-000000000001"
const SES_EMPAREJANDO = "f0000000-0000-0000-0000-000000000002"
const SES_CADUCADA = "f0000000-0000-0000-0000-000000000003"
const SES_B = "f0000000-0000-0000-0000-000000000004"

const PR_EMPAREJANDO = "10000000-0000-0000-0000-000000000001"
const PR_CADUCADA = "10000000-0000-0000-0000-000000000002"
const PR_B = "10000000-0000-0000-0000-000000000003"

const ITEM_A = "04000000-0000-0000-0000-000000000001"
const ITEM_B = "04000000-0000-0000-0000-000000000002"

const STAFF_SERVER_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_SERVER_B = "b0000000-0000-0000-0000-000000000002"
const STAFF_OWNER_A = "b0000000-0000-0000-0000-000000000011"
const STAFF_MANAGER_A = "b0000000-0000-0000-0000-000000000012"
const STAFF_OWNER_B = "b0000000-0000-0000-0000-000000000013"
const STAFF_PLATFORM = "b0000000-0000-0000-0000-000000000014"

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

type Contexto = {
  readonly tableCode?: string
  readonly tableId?: string
  readonly locationId?: string
  readonly sessionId?: string
  readonly orgId?: string
  readonly staffId?: string
  readonly role?: string
}

const STAFF_A: Contexto = { orgId: ORG1, staffId: STAFF_SERVER_A, role: "server" }
const STAFF_B: Contexto = { orgId: ORG2, staffId: STAFF_SERVER_B, role: "server" }
const OWNER_A: Contexto = { orgId: ORG1, staffId: STAFF_OWNER_A, role: "org_owner" }
const MANAGER_A: Contexto = {
  orgId: ORG1,
  staffId: STAFF_MANAGER_A,
  role: "location_manager",
  locationId: LOC_A,
}
const OWNER_B: Contexto = { orgId: ORG2, staffId: STAFF_OWNER_B, role: "org_owner" }
const PLATFORM: Contexto = { orgId: ORG1, staffId: STAFF_PLATFORM, role: "platform_admin" }

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

/** Devuelve cuantas filas afecta una escritura, o -1 si la RLS la rechaza con un error. */
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
  } catch {
    return -1
  } finally {
    await cliente.query("rollback")
  }
}

async function contar(contexto: Contexto, sql: string, valores: unknown[] = []): Promise<number> {
  const filas = await conContexto<{ n: number }>(
    contexto,
    `select count(*)::int as n ${sql}`,
    valores,
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
        ('${LOC_B}', '${ORG2}', 'local-b', 'Local B', 'active'),
        ('${LOC_DRAFT}', '${ORG1}', 'local-draft', 'Local en montaje', 'draft');

      insert into public.tables (id, location_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'Mesa A1', '${CODIGO_A}'),
        ('${MESA_B1}', '${LOC_B}', 'Mesa B1', '${CODIGO_B}'),
        ('${MESA_DRAFT}', '${LOC_DRAFT}', 'Mesa montaje', '${CODIGO_DRAFT}');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_SERVER_A}', '${ORG1}', '${LOC_A}', 'serverA@camarero.test', 'server', 'Camarero A'),
        ('${STAFF_SERVER_B}', '${ORG2}', '${LOC_B}', 'serverB@camarero.test', 'server', 'Camarero B'),
        ('${STAFF_OWNER_A}', '${ORG1}', null, 'ownerA@camarero.test', 'org_owner', 'Dueno A'),
        ('${STAFF_MANAGER_A}', '${ORG1}', '${LOC_A}', 'managerA@camarero.test', 'location_manager', 'Encargado A'),
        ('${STAFF_OWNER_B}', '${ORG2}', null, 'ownerB@camarero.test', 'org_owner', 'Dueno B'),
        ('${STAFF_PLATFORM}', '${ORG1}', null, 'plataforma@camarero.test', 'platform_admin', 'Plataforma');

      insert into public.menu_categories (id, location_id, name_i18n) values
        ('03000000-0000-0000-0000-000000000001', '${LOC_A}', '{"es":"Entrantes A"}'),
        ('03000000-0000-0000-0000-000000000002', '${LOC_B}', '{"es":"Entrantes B"}');

      insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, active, available) values
        ('${ITEM_A}', '${LOC_A}', '03000000-0000-0000-0000-000000000001', '{"es":"Empanada A"}', 1500, true, true),
        ('${ITEM_B}', '${LOC_B}', '03000000-0000-0000-0000-000000000002', '{"es":"Empanada B"}', 1500, true, true);

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state, pairing_expires_at) values
        ('${SES_ACTIVA}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-ACTIVA', 'active', null),
        ('${SES_EMPAREJANDO}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-PAIR', 'pairing', now() + public.camarero_ventana_de_emparejamiento()),
        ('${SES_CADUCADA}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-EXP', 'pairing', now() - interval '1 minute'),
        ('${SES_B}', '${ORG2}', '${LOC_B}', '${MESA_B1}', 'MESA-B-PAIR', 'pairing', now() + public.camarero_ventana_de_emparejamiento());

      insert into public.pairing_requests (id, session_id, table_id, state) values
        ('${PR_EMPAREJANDO}', '${SES_EMPAREJANDO}', '${MESA_A1}', 'pending'),
        ('${PR_CADUCADA}', '${SES_CADUCADA}', '${MESA_A1}', 'pending'),
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
  if (entorno !== undefined) {
    entorno.detener()
  }
})

// ---------------------------------------------------------------------------
// Cerradura 1: resolver la mesa por su codigo
// ---------------------------------------------------------------------------

describe("Cerradura 1: la mesa se resuelve SOLO por el codigo del contexto", () => {
  it("debe resolver la fila de la mesa cuyo codigo viene en el contexto", async () => {
    const filas = await conContexto<{ id: string }>(
      { tableCode: CODIGO_A },
      "select id from public.tables where code = $1",
      [CODIGO_A],
    )
    expect(filas.map((fila) => fila.id)).toEqual([MESA_A1])
  })

  it("no debe resolver nada con un codigo inventado", async () => {
    expect(
      await contar({ tableCode: CODIGO_INVENTADO }, "from public.tables where code = $1", [
        CODIGO_INVENTADO,
      ]),
    ).toBe(0)
  })

  it("con el contexto de una mesa no se ve la mesa de otro local", async () => {
    expect(
      await contar({ tableCode: CODIGO_A }, "from public.tables where id = $1", [MESA_B1]),
    ).toBe(0)
  })

  it("con la sesion de una mesa no se ve la carta de otro local", async () => {
    expect(
      await contar({ sessionId: SES_ACTIVA }, "from public.menu_items where location_id = $1", [
        LOC_B,
      ]),
    ).toBe(0)
    // Y la suya si la ve: la prueba no es vacua.
    expect(await contar({ sessionId: SES_ACTIVA }, "from public.menu_items")).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Cerradura 2: abrir la sesion de la mesa del contexto
// ---------------------------------------------------------------------------

/** Abre una sesion como comensal y, sin salir de la transaccion, lee la carta de su local. */
async function abrirSesionYleerCarta(
  contexto: Contexto,
  locationId: string,
): Promise<{ readonly creada: boolean; readonly carta: readonly string[] }> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    await aplicarContexto(cliente, contexto)
    // El identificador lo genera el borde y NO se usa RETURNING: un INSERT con RETURNING
    // aplica tambien las politicas de SELECT, y la sesion aun no esta en el contexto.
    const id = randomUUID()
    await cliente.query(
      `insert into public.table_sessions (id, location_id, table_id, code, state, pairing_expires_at)
       values ($1, $2, $3, 'MESA', 'pairing', now() + public.camarero_ventana_de_emparejamiento())`,
      [id, locationId, MESA_A1],
    )
    await cliente.query("select set_config('app.session_id', $1, true)", [id])
    const carta = await cliente.query<{ id: string }>(
      "select id from public.menu_items where location_id = $1 order by id",
      [LOC_A],
    )
    return { creada: true, carta: carta.rows.map((fila) => fila.id) }
  } catch {
    return { creada: false, carta: [] }
  } finally {
    await cliente.query("rollback")
  }
}

describe("Cerradura 2: la sesion del comensal", () => {
  it("debe crear la sesion de su mesa y ver la carta de su local", async () => {
    const resultado = await abrirSesionYleerCarta(
      { tableCode: CODIGO_A, tableId: MESA_A1, locationId: LOC_A },
      LOC_A,
    )
    expect(resultado.creada).toBe(true)
    expect(resultado.carta).toEqual([ITEM_A])
  })

  it("no debe dar acceso a otra carta si la localidad no es la de la mesa", async () => {
    // La mesa correcta, pero la localidad de otro local: la cerradura cierra.
    const resultado = await abrirSesionYleerCarta(
      { tableCode: CODIGO_A, tableId: MESA_A1, locationId: LOC_B },
      LOC_B,
    )
    expect(resultado.creada).toBe(false)
    expect(resultado.carta).toEqual([])
  })

  it("no debe crear la sesion de una mesa que no es la del contexto", async () => {
    const filas = await escribirConContexto(
      { tableCode: CODIGO_A, tableId: MESA_B1, locationId: LOC_B },
      `insert into public.table_sessions (location_id, table_id, code, state, pairing_expires_at)
       values ($1, $2, 'MESA', 'pairing', now() + public.camarero_ventana_de_emparejamiento())`,
      [LOC_B, MESA_B1],
    )
    expect(filas).not.toBe(1)
  })

  it("no debe poder crear la sesion ya aprobada (state active)", async () => {
    const filas = await escribirConContexto(
      { tableCode: CODIGO_A, tableId: MESA_A1, locationId: LOC_A },
      `insert into public.table_sessions (location_id, table_id, code, state, pairing_expires_at)
       values ($1, $2, 'MESA', 'active', now() + public.camarero_ventana_de_emparejamiento())`,
      [LOC_A, MESA_A1],
    )
    expect(filas).not.toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Barrera: la aprobacion humana manda de verdad
// ---------------------------------------------------------------------------

function insertarComanda(sesionId: string): Promise<number> {
  return escribirConContexto(
    { sessionId: sesionId },
    `insert into public.orders
       (org_id, location_id, session_id, source, status, subtotal_clp, total_clp, idempotency_key)
     values ($1, $2, $3, 'table', 'pendiente', 1000, 1000, $4)`,
    [ORG1, LOC_A, sesionId, `idem-${sesionId}`],
  )
}

describe("Barrera de aprobacion: pedir sin aprobar FALLA", () => {
  it("no debe dejar crear una comanda con una sesion sin aprobar", async () => {
    expect(await insertarComanda(SES_EMPAREJANDO)).not.toBe(1)
  })

  it("si debe dejar crear una comanda con una sesion aprobada", async () => {
    expect(await insertarComanda(SES_ACTIVA)).toBe(1)
  })

  it("el comensal no puede colar una solicitud ya aprobada", async () => {
    const filas = await escribirConContexto(
      { sessionId: SES_EMPAREJANDO, tableCode: CODIGO_A, tableId: MESA_A1, locationId: LOC_A },
      `insert into public.pairing_requests (session_id, table_id, state, decided_at)
       values ($1, $2, 'approved', now())`,
      [SES_EMPAREJANDO, MESA_A1],
    )
    expect(filas).not.toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Aprobar: vigencia, alcance y el fallo que no se podia ver
// ---------------------------------------------------------------------------

/** Aprueba como un empleado concreto, con la MISMA sentencia que la politica de decision. */
function aprobarComo(contexto: Contexto, solicitudId: string, staffId: string): Promise<number> {
  return escribirConContexto(
    contexto,
    `update public.pairing_requests set state = 'approved', decided_by = $2, decided_at = now()
     where id = $1`,
    [solicitudId, staffId],
  )
}

function aprobar(solicitudId: string): Promise<number> {
  return aprobarComo(STAFF_A, solicitudId, STAFF_SERVER_A)
}

describe("Aprobar una solicitud de emparejamiento", () => {
  it("debe aprobar una solicitud vigente del local", async () => {
    expect(await aprobar(PR_EMPAREJANDO)).toBe(1)
  })

  it("no debe aprobar una solicitud caducada", async () => {
    // La decision exige ventana viva y la unica transicion que la RLS deja pasar sin ventana
    // es pending -> expired, de modo que la aprobacion no se aplica (error o cero filas).
    expect(await aprobar(PR_CADUCADA)).not.toBe(1)
  })

  it("un empleado de otro local no debe poder aprobarla", async () => {
    // El camarero del local A no alcanza una solicitud del local B.
    expect(await aprobarComo(STAFF_A, PR_B, STAFF_SERVER_A)).toBe(0)
    // Y el del mismo local si puede: la prueba no es vacua.
    expect(await aprobarComo(STAFF_B, PR_B, STAFF_SERVER_B)).toBe(1)
  })

  it("el dueno de la organizacion debe poder aprobar (regresion exacta de LL-024)", async () => {
    // Este ERA el fallo: el dueno veia la fila y la base le negaba actuar (0 filas).
    expect(await aprobarComo(OWNER_A, PR_EMPAREJANDO, STAFF_OWNER_A)).toBe(1)
  })

  it("el dueno de OTRA organizacion no debe poder aprobarla", async () => {
    expect(await aprobarComo(OWNER_B, PR_EMPAREJANDO, STAFF_OWNER_B)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// El invariante que faltaba: quien VE una solicitud puede ACCIONAR sobre ella
// ---------------------------------------------------------------------------

const VEN_PR: ReadonlyArray<readonly [string, Contexto, string]> = [
  ["plataforma", PLATFORM, STAFF_PLATFORM],
  ["dueno de la organizacion", OWNER_A, STAFF_OWNER_A],
  ["encargado del local", MANAGER_A, STAFF_MANAGER_A],
  ["camarero del local", STAFF_A, STAFF_SERVER_A],
]

const NO_VEN_PR: ReadonlyArray<readonly [string, Contexto, string]> = [
  ["dueno de otra organizacion", OWNER_B, STAFF_OWNER_B],
  ["camarero de otro local", STAFF_B, STAFF_SERVER_B],
]

describe("Quien puede VER una solicitud puede ACCIONAR sobre ella (LL-024)", () => {
  it("debe coincidir el alcance de la lectura con el de la decision, rol a rol", async () => {
    for (const [nombre, contexto, staffId] of VEN_PR) {
      const ve = await contar(contexto, "from public.pairing_requests where id = $1", [
        PR_EMPAREJANDO,
      ])
      const accion = await aprobarComo(contexto, PR_EMPAREJANDO, staffId)
      expect({ nombre, ve, accion }).toEqual({ nombre, ve: 1, accion: 1 })
    }
    for (const [nombre, contexto, staffId] of NO_VEN_PR) {
      const ve = await contar(contexto, "from public.pairing_requests where id = $1", [
        PR_EMPAREJANDO,
      ])
      const accion = await aprobarComo(contexto, PR_EMPAREJANDO, staffId)
      expect({ nombre, ve, accion }).toEqual({ nombre, ve: 0, accion: 0 })
    }
  })
})

// ---------------------------------------------------------------------------
// Caducar: no se aprueba y se marca
// ---------------------------------------------------------------------------

describe("Una solicitud caducada no se aprueba y el mantenimiento la marca", () => {
  it("debe quedarse sin aprobar y pasar a expired sin tocar la vigente", async () => {
    expect(await aprobar(PR_CADUCADA)).not.toBe(1)

    const cliente = clienteApp()
    await cliente.query("begin")
    try {
      await aplicarContexto(cliente, PLATFORM)
      const marcadas = await cliente.query<{ n: number }>(
        "select public.camarero_expirar_solicitudes() as n",
      )
      expect(marcadas.rows[0]?.n).toBe(1)
      const caducada = await cliente.query<{ state: string }>(
        "select state from public.pairing_requests where id = $1",
        [PR_CADUCADA],
      )
      expect(caducada.rows[0]?.state).toBe("expired")
      const vigente = await cliente.query<{ state: string }>(
        "select state from public.pairing_requests where id = $1",
        [PR_EMPAREJANDO],
      )
      expect(vigente.rows[0]?.state).toBe("pending")
    } finally {
      await cliente.query("rollback")
    }
  })
})

// ---------------------------------------------------------------------------
// La ventana: diez minutos desde que se pide, y se renueva
// ---------------------------------------------------------------------------

describe("La ventana de emparejamiento", () => {
  it("debe durar diez minutos y el comensal debe poder renovar la suya sin aprobarse", async () => {
    const duracion = await conContexto<{ s: number }>(
      PLATFORM,
      "select extract(epoch from public.camarero_ventana_de_emparejamiento())::int as s",
    )
    expect(duracion[0]?.s).toBe(600)

    const comensal: Contexto = {
      tableCode: CODIGO_A,
      tableId: MESA_A1,
      locationId: LOC_A,
      sessionId: SES_EMPAREJANDO,
    }
    const renovadas = await escribirConContexto(
      comensal,
      `update public.table_sessions
          set pairing_expires_at = now() + public.camarero_ventana_de_emparejamiento()
        where id = $1`,
      [SES_EMPAREJANDO],
    )
    expect(renovadas).toBe(1)

    // No puede aprobarse la mesa solo: el estado de la sesion no es suyo.
    const escalada = await escribirConContexto(
      comensal,
      "update public.table_sessions set state = 'active' where id = $1",
      [SES_EMPAREJANDO],
    )
    expect(escalada).not.toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Un local inactivo no abre sesiones
// ---------------------------------------------------------------------------

describe("Un local que no esta activo no abre sesiones de mesa", () => {
  it("no debe crear la sesion de la mesa de un local en borrador", async () => {
    const filas = await escribirConContexto(
      { tableCode: CODIGO_DRAFT, tableId: MESA_DRAFT, locationId: LOC_DRAFT },
      `insert into public.table_sessions (id, location_id, table_id, code, state, pairing_expires_at)
       values ($1, $2, $3, 'MESA', 'pairing', now() + public.camarero_ventana_de_emparejamiento())`,
      [randomUUID(), LOC_DRAFT, MESA_DRAFT],
    )
    expect(filas).not.toBe(1)
  })

  it("si debe crear la sesion cuando el local esta activo (contraste)", async () => {
    const filas = await escribirConContexto(
      { tableCode: CODIGO_A, tableId: MESA_A1, locationId: LOC_A },
      `insert into public.table_sessions (id, location_id, table_id, code, state, pairing_expires_at)
       values ($1, $2, $3, 'MESA', 'pairing', now() + public.camarero_ventana_de_emparejamiento())`,
      [randomUUID(), LOC_A, MESA_A1],
    )
    expect(filas).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Toda decision deja rastro
// ---------------------------------------------------------------------------

describe("Toda decision deja rastro en la auditoria", () => {
  it("debe registrar el acierto y tambien el intento fallido", async () => {
    const cliente = clienteApp()
    await cliente.query("begin")
    try {
      await aplicarContexto(cliente, OWNER_A)

      const aprobada = await cliente.query<{ causa: string }>(
        "select public.camarero_decidir_emparejamiento($1, 'approved', null) as causa",
        [PR_EMPAREJANDO],
      )
      expect(aprobada.rows[0]?.causa).toBe("ok")
      const exito = await cliente.query<{ action: string }>(
        `select action from public.audit_log
          where entity = 'pairing_request' and entity_id = $1
          order by created_at desc, id desc limit 1`,
        [PR_EMPAREJANDO],
      )
      expect(exito.rows[0]?.action).toBe("pairing_request.approved")

      // Una solicitud de otro local: la puerta clasifica la causa y deja rastro del fallo.
      const fallo = await cliente.query<{ causa: string }>(
        "select public.camarero_decidir_emparejamiento($1, 'approved', null) as causa",
        [PR_B],
      )
      expect(fallo.rows[0]?.causa).toBe("otro_local")
      const registrado = await cliente.query<{ action: string }>(
        `select action from public.audit_log
          where entity = 'pairing_request' and entity_id = $1
          order by created_at desc, id desc limit 1`,
        [PR_B],
      )
      expect(registrado.rows[0]?.action).toBe("pairing_request.decision_failed")
    } finally {
      await cliente.query("rollback")
    }
  })
})
