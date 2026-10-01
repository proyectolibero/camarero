/**
 * El cierre de la sesion de mesa, contra Postgres (TASK-F1-10, hallazgo H1).
 *
 * El estado `closed` no lo escribia nadie: no habia cierre por inactividad ni cierre a mano.
 * Aqui se demuestra, contra la base real y a traves del almacen del borde:
 *   - que una sesion sin actividad se cierra al PASAR EL TIEMPO y la sala la vuelve a ver libre;
 *   - que el cierre a mano deja rastro (quien y cuando) y la mesa queda libre;
 *   - que un empleado de otro local no puede cerrarla;
 *   - que una mesa cerrada y reabierta empieza limpia, sin las comandas del servicio anterior.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../../../workers/api/src/base.ts"
import { almacenDeBase } from "../../../workers/api/src/panel/datos.ts"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cadenaDeConexion, cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG1 = "11111111-1111-1111-1111-111111111111"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_B = "bbbbbbbb-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_A2 = "e0000000-0000-0000-0000-000000000002"
const MESA_A3 = "e0000000-0000-0000-0000-000000000003"
const MESA_B1 = "e0000000-0000-0000-0000-000000000004"
const SES_A1 = "f0000000-0000-0000-0000-000000000001"
const SES_A2 = "f0000000-0000-0000-0000-000000000002"
const SES_VIEJA = "f0000000-0000-0000-0000-000000000003"
const SES_NUEVA = "f0000000-0000-0000-0000-000000000004"
const SES_B1 = "f0000000-0000-0000-0000-000000000005"
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"
const ORDEN_VIEJA = "0a000000-0000-0000-0000-000000000010"

let entorno: EntornoDePruebas | undefined

function empleadoDe(staffId: string, localId: string): Empleado {
  return {
    staffId,
    correo: `${staffId}@camarero.test`,
    nombre: "Empleado de prueba",
    rol: "server",
    organizacion: { id: ORG1, nombre: null },
    local: { id: localId, nombre: null },
  }
}

const EMPLEADO_A = empleadoDe(STAFF_A, LOC_A)
const EMPLEADO_B = empleadoDe(STAFF_B, LOC_B)

function almacen() {
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

/** Llama al cierre por inactividad como el cron: contexto de plataforma y reloj simulado. */
async function cerrarInactivas(simularHoras: number): Promise<number> {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  const cliente = await conectar(entorno.parametros.app)
  try {
    await cliente.query("begin")
    await cliente.query("select set_config('app.role', 'platform_admin', true)")
    const resultado = await cliente.query<{ n: number }>(
      "select public.camarero_cerrar_sesiones_inactivas(now() + make_interval(hours => $1::int)) as n",
      [simularHoras],
    )
    await cliente.query("commit")
    return resultado.rows[0]?.n ?? -1
  } finally {
    await cerrar(cliente)
  }
}

async function estadoDeSesion(
  id: string,
): Promise<{ state: string; closed_at: Date | null; closed_by: string | null } | undefined> {
  const cliente = await adminCliente()
  try {
    const resultado = await cliente.query<{
      state: string
      closed_at: Date | null
      closed_by: string | null
    }>("select state, closed_at, closed_by from public.table_sessions where id = $1", [id])
    return resultado.rows[0]
  } finally {
    await cerrar(cliente)
  }
}

async function contarAuditoria(sesionId: string): Promise<number> {
  const cliente = await adminCliente()
  try {
    const resultado = await cliente.query<{ n: number }>(
      `select count(*)::int as n from public.audit_log
        where entity = 'table_session' and entity_id = $1 and action = 'table_session.closed'`,
      [sesionId],
    )
    return resultado.rows[0]?.n ?? -1
  } finally {
    await cerrar(cliente)
  }
}

function sesionActiva(
  sala: readonly { readonly mesa: { readonly id: string }; readonly sesionActiva: boolean }[],
  mesaId: string,
): boolean | undefined {
  return sala.find((resumen) => resumen.mesa.id === mesaId)?.sesionActiva
}

async function sembrar(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values ('${ORG1}', 'Organizacion Uno');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'active'),
        ('${LOC_B}', '${ORG1}', 'local-b', 'Local B', 'active');

      insert into public.tables (id, location_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'Mesa A1', 'ABCDEFGH'),
        ('${MESA_A2}', '${LOC_A}', 'Mesa A2', 'ABCDEFGJ'),
        ('${MESA_A3}', '${LOC_A}', 'Mesa A3', 'ABCDEFGK'),
        ('${MESA_B1}', '${LOC_B}', 'Mesa B1', 'ABCDEFGL');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_A}', '${ORG1}', '${LOC_A}', 'serverA@camarero.test', 'server', 'Camarero A'),
        ('${STAFF_B}', '${ORG1}', '${LOC_B}', 'serverB@camarero.test', 'server', 'Camarero B');

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A1}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A1', 'active'),
        ('${SES_A2}', '${ORG1}', '${LOC_A}', '${MESA_A2}', 'MESA-A2', 'active'),
        ('${SES_NUEVA}', '${ORG1}', '${LOC_A}', '${MESA_A3}', 'MESA-A3-NUEVA', 'active'),
        ('${SES_B1}', '${ORG1}', '${LOC_B}', '${MESA_B1}', 'MESA-B1', 'active');
    `)
    // `closed` exige `closed_at` (check de 0005): el servicio anterior se inserta ya cerrado.
    await cliente.query(
      `insert into public.table_sessions (id, org_id, location_id, table_id, code, state, closed_at)
       values ($1, '${ORG1}', '${LOC_A}', '${MESA_A3}', 'MESA-A3-VIEJA', 'closed', now() - interval '2 hours')`,
      [SES_VIEJA],
    )
    // Una comanda del servicio anterior, en la sesion ya cerrada de la mesa A3.
    await cliente.query(
      `insert into public.orders
         (id, org_id, location_id, session_id, source, status, prep_station, idempotency_key)
       values ($1, $2, $3, $4, 'table', 'pendiente', 'Cocina', $5)`,
      [ORDEN_VIEJA, ORG1, LOC_A, SES_VIEJA, `idem-${ORDEN_VIEJA}`],
    )
  } finally {
    await cerrar(cliente)
  }
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrar(entorno.parametros.admin)
}, 240_000)

afterAll(async () => {
  entorno?.detener()
})

describe("Cierre a mano: deja rastro y la mesa vuelve a libre", () => {
  it("no debe dejar cerrar la mesa a un empleado de otro local", async () => {
    const ajeno = await almacen().cerrarSesion(EMPLEADO_B, MESA_A2)
    expect(ajeno).toEqual({ ok: false, motivo: "no_existe" })
    // La sesion sigue viva: el intento ajeno no cambio nada.
    const estado = await estadoDeSesion(SES_A2)
    expect(estado?.state).toBe("active")
  })

  it("debe cerrar la sesion, registrar quien y cuando, y liberar la mesa", async () => {
    const resultado = await almacen().cerrarSesion(EMPLEADO_A, MESA_A2)
    expect(resultado).toEqual({ ok: true, valor: undefined })

    const estado = await estadoDeSesion(SES_A2)
    expect(estado?.state).toBe("closed")
    expect(estado?.closed_at).not.toBeNull()
    expect(estado?.closed_by).toBe(STAFF_A)
    expect(await contarAuditoria(SES_A2)).toBe(1)

    const sala = await almacen().listarSala(EMPLEADO_A)
    expect(sesionActiva(sala, MESA_A2)).toBe(false)
  })

  it("no debe cerrar dos veces la misma mesa: el segundo intento no encuentra sesion", async () => {
    const resultado = await almacen().cerrarSesion(EMPLEADO_A, MESA_A2)
    expect(resultado).toEqual({ ok: false, motivo: "no_existe" })
  })
})

describe("Una mesa cerrada y reabierta empieza limpia", () => {
  it("no debe mezclar las comandas del servicio anterior con las de la sesion nueva", async () => {
    const comandas = await almacen().listarComandasDeMesa(EMPLEADO_A, MESA_A3)
    expect(comandas).toEqual([])
    const todas = await almacen().listarComandas(EMPLEADO_A, "todo")
    expect(todas.some((comanda) => comanda.id === ORDEN_VIEJA)).toBe(false)
    // La comanda vieja sigue en la base: no se borro, solo dejo de mostrarse.
    const cliente = await adminCliente()
    try {
      const resultado = await cliente.query<{ n: number }>(
        "select count(*)::int as n from public.orders where id = $1",
        [ORDEN_VIEJA],
      )
      expect(resultado.rows[0]?.n).toBe(1)
    } finally {
      await cerrar(cliente)
    }
  })
})

// Ultimo a proposito: adelanta el reloj y cierra TODAS las sesiones abiertas que queden.
describe("Cierre por inactividad: la prueba que pasa el tiempo", () => {
  it("no debe cerrar nada antes de que pase la vida de la sesion", async () => {
    // Con el reloj real, las sesiones recien abiertas siguen vivas.
    expect(await cerrarInactivas(0)).toBe(0)
  })

  it("debe cerrar la sesion inactiva al pasar cuatro horas y la sala verla libre", async () => {
    const salaAntes = await almacen().listarSala(EMPLEADO_A)
    expect(sesionActiva(salaAntes, MESA_A1)).toBe(true)

    // La prueba PASA EL TIEMPO: el reloj del cierre avanza cinco horas.
    const cerradas = await cerrarInactivas(5)
    expect(cerradas).toBeGreaterThanOrEqual(1)

    const estado = await estadoDeSesion(SES_A1)
    expect(estado?.state).toBe("closed")
    expect(estado?.closed_at).not.toBeNull()
    // La cerro el tiempo, no una persona.
    expect(estado?.closed_by).toBeNull()

    const salaDespues = await almacen().listarSala(EMPLEADO_A)
    expect(sesionActiva(salaDespues, MESA_A1)).toBe(false)
    // Y tambien la del otro local.
    const salaB = await almacen().listarSala(EMPLEADO_B)
    expect(sesionActiva(salaB, MESA_B1)).toBe(false)
  })
})
