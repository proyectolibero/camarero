/**
 * La cuenta contra Postgres: pedirla, verla y cobrarla (TASK-F3-01, D-039, CONTRACT-dinero).
 *
 * Demuestra, contra la base real y a traves del almacen del borde:
 *   - que el comensal pide la cuenta y, desde ese momento, la BASE le cierra la via de pedir
 *     platos (forzar el POST o la sentencia no sirve: la cerradura es `puede_crear_orden`);
 *   - que antes de pedirla SI podia (la prueba no es vacua);
 *   - que la cuenta la ve el local, no otro local, y no el comensal de otra mesa;
 *   - que un empleado registra el cobro, la mesa se cierra y queda rastro en auditoria;
 *   - que el importe sale de la base (se ignora cualquier importe ajeno) y la propina se
 *     calcula con la funcion del dominio sobre el importe ya descontado;
 *   - que un comensal NO puede registrar un cobro.
 *
 * Se conecta como `camarero_app` (nunca el propietario: LL-004).
 */
import type { QueryResultRow } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../../../workers/api/src/base.ts"
import { almacenComensalDeBase } from "../../../workers/api/src/comensal/datos.ts"
import { almacenDeBase } from "../../../workers/api/src/panel/datos.ts"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cadenaDeConexion, cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_B = "bbbbbbbb-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_A2 = "e0000000-0000-0000-0000-000000000002"
const MESA_B1 = "e0000000-0000-0000-0000-000000000003"
const CODIGO_A1 = "ABCDEFGH"
const CODIGO_A2 = "ABCDEFGJ"
const SES_A1 = "f0000000-0000-0000-0000-000000000001"
const SES_A2 = "f0000000-0000-0000-0000-000000000002"
const SES_B1 = "f0000000-0000-0000-0000-000000000003"
const ITEM_A = "04000000-0000-0000-0000-000000000001"
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"

let entorno: EntornoDePruebas | undefined

function empleadoDe(staffId: string, orgId: string, localId: string): Empleado {
  return {
    staffId,
    correo: `${staffId}@camarero.test`,
    nombre: "Empleado de prueba",
    rol: "server",
    organizacion: { id: orgId, nombre: null },
    local: { id: localId, nombre: null },
  }
}

const EMPLEADO_A = empleadoDe(STAFF_A, ORG1, LOC_A)
const EMPLEADO_B = empleadoDe(STAFF_B, ORG2, LOC_B)

function comensal() {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return almacenComensalDeBase(cadenaDeConexion(entorno.parametros.app))
}

function panel() {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return almacenDeBase(cadenaDeConexion(entorno.parametros.app))
}

async function adminCliente(): Promise<ClientePostgres> {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return await conectar(entorno.parametros.admin)
}

type Contexto = {
  readonly sessionId?: string
  readonly tableId?: string
  readonly locationId?: string
  readonly orgId?: string
  readonly staffId?: string
  readonly role?: string
  readonly tableCode?: string
}

function contextoComensal(sesionId: string, mesaId: string, codigo: string): Contexto {
  return {
    sessionId: sesionId,
    tableId: mesaId,
    locationId: LOC_A,
    tableCode: codigo,
  }
}

/** Aplica el contexto en una transaccion y devuelve si la sentencia paso (1) o la RLS la nego (0). */
async function intentarComoRls(
  contexto: Contexto,
  ejecutar: (cliente: ClientePostgres) => Promise<unknown>,
): Promise<number> {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  const cliente = await conectar(entorno.parametros.app)
  try {
    await cliente.query("begin")
    await cliente.query("savepoint intento")
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
    try {
      await ejecutar(cliente)
      await cliente.query("release savepoint intento")
      return 1
    } catch {
      await cliente.query("rollback to savepoint intento")
      return 0
    }
  } finally {
    await cliente.query("rollback")
    await cerrar(cliente)
  }
}

async function consultaAdmin<T extends QueryResultRow>(
  sql: string,
  valores: unknown[],
): Promise<T[]> {
  const cliente = await adminCliente()
  try {
    const resultado = await cliente.query<T>(sql, valores)
    return resultado.rows
  } finally {
    await cerrar(cliente)
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
        ('${MESA_A1}', '${LOC_A}', 'Mesa A1', '${CODIGO_A1}'),
        ('${MESA_A2}', '${LOC_A}', 'Mesa A2', '${CODIGO_A2}'),
        ('${MESA_B1}', '${LOC_B}', 'Mesa B1', 'ABCDEFGK');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_A}', '${ORG1}', '${LOC_A}', 'serverA@camarero.test', 'server', 'Camarero A'),
        ('${STAFF_B}', '${ORG2}', '${LOC_B}', 'serverB@camarero.test', 'server', 'Camarero B');

      insert into public.menu_items (id, location_id, name_i18n, price_clp, active, available) values
        ('${ITEM_A}', '${LOC_A}', '{"es":"Lomo a lo pobre"}', 9000, true, true);

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A1}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A1', 'active'),
        ('${SES_A2}', '${ORG1}', '${LOC_A}', '${MESA_A2}', 'MESA-A2', 'active'),
        ('${SES_B1}', '${ORG2}', '${LOC_B}', '${MESA_B1}', 'MESA-B1', 'active');
    `)
  } finally {
    await cerrar(cliente)
  }
}

/** Una cesta de una linea; el precio lo fija la base desde la carta. */
function cestaDeUnaLinea() {
  return [
    {
      platoId: ITEM_A,
      cantidad: 1,
      puestoId: null,
      puestoNombre: null,
      autoAcepta: true,
    },
  ]
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrar(entorno.parametros.admin)
}, 240_000)

afterAll(() => {
  entorno?.detener()
})

describe("El comensal pide la cuenta", () => {
  it("debe poder pedir platos ANTES de pedir la cuenta, y quedar la cuenta pedida despues", async () => {
    const antes = await comensal().enviar(CODIGO_A1, SES_A1, "cuenta-antes", cestaDeUnaLinea())
    expect(antes.tipo).toBe("ok")

    const pedida = await comensal().pedirCuenta(CODIGO_A1, SES_A1)
    expect(pedida.tipo).toBe("ok")

    // Volver a pedirla no crea otra ni falla: la peticion viva es una sola.
    const otraVez = await comensal().pedirCuenta(CODIGO_A1, SES_A1)
    expect(otraVez.tipo).toBe("ok")

    const cuentas = await consultaAdmin<{ n: number }>(
      "select count(*)::int as n from public.bill_requests where session_id = $1",
      [SES_A1],
    )
    expect(cuentas[0]?.n).toBe(1)
  })

  it("NO debe poder pedir platos despues de pedir la cuenta", async () => {
    const despues = await comensal().enviar(CODIGO_A1, SES_A1, "cuenta-despues", cestaDeUnaLinea())
    expect(despues.tipo).toBe("cuenta_pedida")
    // Y no se creo ninguna comanda nueva con esa clave.
    const creadas = await consultaAdmin<{ n: number }>(
      "select count(*)::int as n from public.orders where idempotency_key like 'cuenta-despues.%'",
      [],
    )
    expect(creadas[0]?.n).toBe(0)
  })

  it("la via directa a la base tambien queda cerrada: la RLS rechaza la comanda con cuenta pedida", async () => {
    const conCuenta = await intentarComoRls(
      contextoComensal(SES_A1, MESA_A1, CODIGO_A1),
      (cliente) =>
        cliente.query(
          `insert into public.orders (org_id, location_id, session_id, source, idempotency_key)
         values ($1, $2, $3, 'table', 'directo-con-cuenta')`,
          [ORG1, LOC_A, SES_A1],
        ),
    )
    // Contraste: la misma sentencia SIN cuenta pedida (sesion A2) si pasa.
    const sinCuenta = await intentarComoRls(
      contextoComensal(SES_A2, MESA_A2, CODIGO_A2),
      (cliente) =>
        cliente.query(
          `insert into public.orders (org_id, location_id, session_id, source, idempotency_key)
         values ($1, $2, $3, 'table', 'directo-sin-cuenta')`,
          [ORG1, LOC_A, SES_A2],
        ),
    )
    expect(conCuenta).toBe(0)
    expect(sinCuenta).toBe(1)
  })
})

describe("El local ve la cuenta; otro local y otra mesa no", () => {
  it("debe verla el local de la mesa, con su consumo, y no el local ajeno", async () => {
    const propias = await panel().listarCuentas(EMPLEADO_A)
    const deA1 = propias.find((cuenta) => cuenta.mesaId === MESA_A1)
    expect(deA1).toBeDefined()
    // El consumo sale de la comanda aceptada: 9.000 x 1.
    expect(deA1?.subtotalClp).toBe(9000)
    expect(deA1?.importeClp).toBe(9000)
    expect(deA1?.cobrada).toBe(false)

    const ajenas = await panel().listarCuentas(EMPLEADO_B)
    expect(ajenas).toEqual([])
  })

  it("no debe ver el comensal de OTRA mesa la cuenta de esta", async () => {
    const vistas = await intentarComoRls(
      contextoComensal(SES_A2, MESA_A2, CODIGO_A2),
      async (cliente) => {
        const resultado = await cliente.query<{ n: number }>(
          "select count(*)::int as n from public.bill_requests where session_id = $1",
          [SES_A1],
        )
        if (resultado.rows[0]?.n !== 0) {
          throw new Error("El comensal de otra mesa no deberia ver la cuenta")
        }
      },
    )
    expect(vistas).toBe(1)
  })
})

describe("El empleado registra el cobro", () => {
  it("no debe dejar cobrar a un empleado de otro local", async () => {
    const cuenta = (await panel().listarCuentas(EMPLEADO_A)).find(
      (candidata) => candidata.mesaId === MESA_A1,
    )
    if (cuenta === undefined) {
      throw new Error("Falta la cuenta de la mesa A1")
    }
    const ajeno = await panel().cobrar(EMPLEADO_B, {
      cuentaId: cuenta.id,
      formaDePago: "tpv_cash",
      tipPercent: 10,
    })
    expect(ajeno.ok).toBe(false)
  })

  it("debe registrar el cobro, cerrar la mesa y dejar rastro en auditoria", async () => {
    const cuenta = (await panel().listarCuentas(EMPLEADO_A)).find(
      (candidata) => candidata.mesaId === MESA_A1,
    )
    if (cuenta === undefined) {
      throw new Error("Falta la cuenta de la mesa A1")
    }
    const resultado = await panel().cobrar(EMPLEADO_A, {
      cuentaId: cuenta.id,
      formaDePago: "tpv_cash",
      tipPercent: 10,
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) {
      return
    }
    // El importe sale de la base (9.000) y la propina del 10 % sobre el importe: 900.
    expect(resultado.valor).toEqual({ importeClp: 9000, propinaClp: 900, totalClp: 9900 })

    const sesion = await consultaAdmin<{ state: string }>(
      "select state from public.table_sessions where id = $1",
      [SES_A1],
    )
    expect(sesion[0]?.state).toBe("closed")

    const cobros = await consultaAdmin<{
      settled_by_staff_id: string
      payment_method: string
      total_clp: number
      tip_clp: number
    }>(
      "select settled_by_staff_id, payment_method, total_clp, tip_clp from public.checkouts where session_id = $1",
      [SES_A1],
    )
    expect(cobros).toHaveLength(1)
    expect(cobros[0]?.settled_by_staff_id).toBe(STAFF_A)
    expect(cobros[0]?.payment_method).toBe("tpv_cash")
    expect(cobros[0]?.total_clp).toBe(9900)
    expect(cobros[0]?.tip_clp).toBe(900)

    const auditoria = await consultaAdmin<{ n: number }>(
      `select count(*)::int as n from public.audit_log
        where action = 'checkout.registered' and actor_staff_id = $1`,
      [STAFF_A],
    )
    expect(auditoria[0]?.n).toBe(1)
  })

  it("no debe cobrar dos veces la misma cuenta", async () => {
    const cuenta = (await panel().listarCuentas(EMPLEADO_A)).find(
      (candidata) => candidata.mesaId === MESA_A1,
    )
    if (cuenta === undefined) {
      throw new Error("Falta la cuenta de la mesa A1")
    }
    expect(cuenta.cobrada).toBe(true)
    const repetido = await panel().cobrar(EMPLEADO_A, {
      cuentaId: cuenta.id,
      formaDePago: "tpv_card",
      tipPercent: 0,
    })
    expect(repetido).toEqual({ ok: false, motivo: "ya_cobrada" })
    const cobros = await consultaAdmin<{ n: number }>(
      "select count(*)::int as n from public.checkouts where session_id = $1",
      [SES_A1],
    )
    expect(cobros[0]?.n).toBe(1)
  })

  it("el comensal NO debe poder registrar un cobro", async () => {
    const cuenta = (
      await consultaAdmin<{ id: string }>(
        "select id from public.bill_requests where session_id = $1 limit 1",
        [SES_A1],
      )
    )[0]
    if (cuenta === undefined) {
      throw new Error("Falta la cuenta de la mesa A1")
    }
    const intento = await intentarComoRls(contextoComensal(SES_A1, MESA_A1, CODIGO_A1), (cliente) =>
      cliente.query(
        `insert into public.checkouts (session_id, settled_by_staff_id, payment_method, total_clp, tip_clp)
           values ($1, $2, 'tpv_cash', 1, 0)`,
        [SES_A1, STAFF_A],
      ),
    )
    expect(intento).toBe(0)
  })
})
