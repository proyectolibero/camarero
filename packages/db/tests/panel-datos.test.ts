/**
 * La capa de datos del panel contra Postgres, de punta a punta (hallazgo 2 de la auditoria).
 *
 * La consulta SQL que hace que una comanda llegue a la pantalla de su puesto NUNCA se ejecutaba
 * contra la base: se probaba con un doble falso en dos mitades desconectadas. Aqui se llama al
 * almacen REAL del borde (`almacenDeBase`) contra el Postgres efimero y se demuestra que
 * `listarComandas` filtra de verdad por puesto, que `listarSala` ve lo que debe y que
 * `listarComandasDeMesa` no mezcla mesas ni servicios cerrados.
 *
 * Se conecta como `camarero_app` (nunca el propietario: LL-004). Los datos se siembran con el
 * administrador y se commitean, porque el almacen abre su propia conexion.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../../../workers/api/src/base.ts"
import { almacenDeBase } from "../../../workers/api/src/panel/datos.ts"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cadenaDeConexion, cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG_A = "11111111-1111-1111-1111-111111111111"
const ORG_B = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_B = "bbbbbbbb-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const MESA_A2 = "e0000000-0000-0000-0000-000000000002"
const MESA_B1 = "e0000000-0000-0000-0000-000000000003"
const SES_A1 = "f0000000-0000-0000-0000-000000000001"
const SES_A2 = "f0000000-0000-0000-0000-000000000002"
const SES_B1 = "f0000000-0000-0000-0000-000000000003"
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"
const MESA_CERRADA = "e0000000-0000-0000-0000-000000000004"
const SES_CERRADA = "f0000000-0000-0000-0000-000000000004"
const SES_NUEVA = "f0000000-0000-0000-0000-000000000005"

const CODIGOS: Readonly<Record<string, string>> = {
  [MESA_A1]: "ABCDEFGH",
  [MESA_A2]: "ABCDEFGJ",
  [MESA_B1]: "ABCDEFGK",
  [MESA_CERRADA]: "ABCDEFGL",
}

let entorno: EntornoDePruebas | undefined
const PUESTOS_A = new Map<string, string>()

function empleadoDe(staffId: string, orgId: string, localId: string, rol: string): Empleado {
  return {
    staffId,
    correo: `${staffId}@camarero.test`,
    nombre: "Empleado de prueba",
    rol,
    organizacion: { id: orgId, nombre: null },
    local: { id: localId, nombre: null },
  }
}

const EMPLEADO_A = empleadoDe(STAFF_A, ORG_A, LOC_A, "server")
const EMPLEADO_B = empleadoDe(STAFF_B, ORG_B, LOC_B, "server")

function almacen() {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return almacenDeBase(cadenaDeConexion(entorno.parametros.app))
}

async function estacion(cliente: ClientePostgres, local: string, nombre: string): Promise<string> {
  const resultado = await cliente.query<{ id: string }>(
    "select id from public.kitchen_stations where location_id = $1 and name = $2",
    [local, nombre],
  )
  const id = resultado.rows[0]?.id
  if (id === undefined) {
    throw new Error(`No hay puesto ${nombre} en ${local}`)
  }
  return id
}

/**
 * Crea una comanda de mesa en un puesto. No se anaden lineas: lo que se prueba es el FILTRO por
 * puesto y por mesa, y las lineas no intervienen. `name_snapshot` se guarda en `prep_station`
 * (el nombre congelado) igual que hace el borde.
 */
async function sembrarComanda(
  cliente: ClientePostgres,
  id: string,
  sesion: string,
  local: string,
  org: string,
  puestoId: string,
  puestoNombre: string,
  estado = "pendiente",
): Promise<void> {
  await cliente.query(
    `insert into public.orders
       (id, org_id, location_id, session_id, source, status, prep_station, prep_station_id, idempotency_key)
     values ($1, $2, $3, $4, 'table', $5, $6, $7, $8)`,
    [id, org, local, sesion, estado, puestoNombre, puestoId, `idem-${id}`],
  )
}

async function sembrar(admin2: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin2)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values
        ('${ORG_A}', 'Organizacion A'),
        ('${ORG_B}', 'Organizacion B');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG_A}', 'local-a', 'Local A', 'active'),
        ('${LOC_B}', '${ORG_B}', 'local-b', 'Local B', 'active');

      insert into public.tables (id, location_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'Mesa A1', '${CODIGOS[MESA_A1]}'),
        ('${MESA_A2}', '${LOC_A}', 'Mesa A2', '${CODIGOS[MESA_A2]}'),
        ('${MESA_CERRADA}', '${LOC_A}', 'Mesa A3', '${CODIGOS[MESA_CERRADA]}'),
        ('${MESA_B1}', '${LOC_B}', 'Mesa B1', '${CODIGOS[MESA_B1]}');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_A}', '${ORG_A}', '${LOC_A}', 'serverA@camarero.test', 'server', 'Camarero A'),
        ('${STAFF_B}', '${ORG_B}', '${LOC_B}', 'serverB@camarero.test', 'server', 'Camarero B');

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A1}', '${ORG_A}', '${LOC_A}', '${MESA_A1}', 'MESA-A1', 'active'),
        ('${SES_A2}', '${ORG_A}', '${LOC_A}', '${MESA_A2}', 'MESA-A2', 'active'),
        ('${SES_NUEVA}', '${ORG_A}', '${LOC_A}', '${MESA_CERRADA}', 'MESA-A3-NUEVA', 'active'),
        ('${SES_B1}', '${ORG_B}', '${LOC_B}', '${MESA_B1}', 'MESA-B1', 'active');
    `)
    // `closed` exige `closed_at` (check de 0005): la sesion anterior se inserta ya cerrada.
    await cliente.query(
      `insert into public.table_sessions (id, org_id, location_id, table_id, code, state, closed_at)
       values ($1, '${ORG_A}', '${LOC_A}', '${MESA_CERRADA}', 'MESA-A3-ANTERIOR', 'closed', now() - interval '1 hour')`,
      [SES_CERRADA],
    )
    PUESTOS_A.set("cocina", await estacion(cliente, LOC_A, "Cocina"))
    PUESTOS_A.set("frio", await estacion(cliente, LOC_A, "Frío"))

    const cocina = PUESTOS_A.get("cocina")
    const frio = PUESTOS_A.get("frio")
    if (cocina === undefined || frio === undefined) {
      throw new Error("Faltan puestos sembrados")
    }
    // La mesa A1 va a Cocina; la A2 a Frio. Cada una tiene su comanda.
    await sembrarComanda(
      cliente,
      "0a000000-0000-0000-0000-000000000001",
      SES_A1,
      LOC_A,
      ORG_A,
      cocina,
      "Cocina",
    )
    await sembrarComanda(
      cliente,
      "0a000000-0000-0000-0000-000000000002",
      SES_A2,
      LOC_A,
      ORG_A,
      frio,
      "Frío",
    )
    // Comanda del servicio ANTERIOR, en una sesion ya cerrada.
    await sembrarComanda(
      cliente,
      "0a000000-0000-0000-0000-000000000003",
      SES_CERRADA,
      LOC_A,
      ORG_A,
      cocina,
      "Cocina",
    )
    // Comanda del otro local.
    await sembrarComanda(
      cliente,
      "0a000000-0000-0000-0000-000000000004",
      SES_B1,
      LOC_B,
      ORG_B,
      await estacion(cliente, LOC_B, "Cocina"),
      "Cocina",
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

describe("listarComandas filtra de verdad por puesto", () => {
  it("debe dar solo la comanda de Cocina cuando se pide el puesto Cocina", async () => {
    const cocina = PUESTOS_A.get("cocina") ?? ""
    const frio = PUESTOS_A.get("frio") ?? ""
    const deCocina = await almacen().listarComandas(EMPLEADO_A, cocina)
    const deFrio = await almacen().listarComandas(EMPLEADO_A, frio)
    expect(deCocina.map((c) => c.destino)).toEqual(["Cocina"])
    expect(deFrio.map((c) => c.destino)).toEqual(["Frío"])
  })

  it("debe dar todas las del local (menos las del servicio cerrado) en la pantalla «todo»", async () => {
    const todas = await almacen().listarComandas(EMPLEADO_A, "todo")
    expect(new Set(todas.map((c) => c.destino))).toEqual(new Set(["Cocina", "Frío"]))
    // La comanda de la sesion CERRADA no debe aparecer en ninguna pantalla de trabajo.
    expect(todas.some((c) => c.id === "0a000000-0000-0000-0000-000000000003")).toBe(false)
  })

  it("un empleado de otro local solo debe ver las comandas de su local", async () => {
    const deB = await almacen().listarComandas(EMPLEADO_B, "todo")
    expect(deB.map((c) => c.mesa)).toEqual(["Mesa B1"])
    expect(deB.some((c) => c.id === "0a000000-0000-0000-0000-000000000001")).toBe(false)
  })
})

describe("listarSala ve lo que debe", () => {
  it("debe marcar con sesion activa las mesas abiertas y con cero la cerrada", async () => {
    const sala = await almacen().listarSala(EMPLEADO_A)
    const porId = new Map(sala.map((resumen) => [resumen.mesa.id, resumen]))
    expect(porId.get(MESA_A1)?.sesionActiva).toBe(true)
    expect(porId.get(MESA_A1)?.comandasSinServir).toBe(1)
    expect(porId.get(MESA_A2)?.sesionActiva).toBe(true)
    // La mesa A3 tiene una sesion cerrada y otra nueva abierta: la sala la ve ocupada por la
    // nueva, no por la vieja.
    expect(porId.get(MESA_CERRADA)?.sesionActiva).toBe(true)
    expect(porId.get(MESA_CERRADA)?.comandasSinServir).toBe(0)
  })

  it("un empleado de otro local no debe ver las mesas ajenas", async () => {
    const sala = await almacen().listarSala(EMPLEADO_B)
    expect(sala.map((resumen) => resumen.mesa.id)).toEqual([MESA_B1])
  })
})

describe("listarComandasDeMesa no mezcla mesas ni servicios", () => {
  it("debe dar solo las comandas de la mesa pedida", async () => {
    const deA1 = await almacen().listarComandasDeMesa(EMPLEADO_A, MESA_A1)
    const deA2 = await almacen().listarComandasDeMesa(EMPLEADO_A, MESA_A2)
    expect(deA1.map((c) => c.id)).toEqual(["0a000000-0000-0000-0000-000000000001"])
    expect(deA2.map((c) => c.id)).toEqual(["0a000000-0000-0000-0000-000000000002"])
  })

  it("no debe mostrar las comandas del servicio anterior de una mesa reabierta", async () => {
    const deMesa = await almacen().listarComandasDeMesa(EMPLEADO_A, MESA_CERRADA)
    expect(deMesa.some((c) => c.id === "0a000000-0000-0000-0000-000000000003")).toBe(false)
    expect(deMesa).toEqual([])
  })
})
