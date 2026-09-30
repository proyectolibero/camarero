/**
 * Gestion del local, zonas y mesas: la cerradura de verdad es la RLS.
 *
 * Aqui NO se prueba la pantalla, sino la base. Se conecta como `camarero_app` (no
 * propietario, sin BYPASSRLS: LL-004) con el contexto de sesion de cada rol, en
 * transacciones que se revierten. Lo que se comprueba es exactamente lo que promete
 * TASK-F1-03: el dueno actualiza su local; el encargado gestiona zonas y mesas de su local
 * pero no renombra el local; el camarero no crea nada; y nadie ve ni toca lo de otra
 * organizacion. El sembrado se hace como administrador (si puede saltar la RLS).
 */
import type { QueryResultRow } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const LOC_C = "cccccccc-0000-0000-0000-000000000001"

const OWNER1 = "b0000000-0000-0000-0000-000000000001"
const MANAGER_A = "b0000000-0000-0000-0000-000000000020"
const SERVER_A = "b0000000-0000-0000-0000-000000000021"
const OWNER2 = "b0000000-0000-0000-0000-000000000022"

const ZONE_A = "d0000000-0000-0000-0000-000000000001"
const CODE_A = "ABCDEFGH"

type Contexto = {
  orgId?: string
  staffId?: string
  role?: string
  locationId?: string
}

const CONTEXTO_OWNER1: Contexto = { orgId: ORG1, staffId: OWNER1, role: "org_owner" }
const CONTEXTO_MANAGER_A: Contexto = { orgId: ORG1, staffId: MANAGER_A, role: "location_manager" }
const CONTEXTO_SERVER_A: Contexto = { orgId: ORG1, staffId: SERVER_A, role: "server" }
const CONTEXTO_OWNER2: Contexto = { orgId: ORG2, staffId: OWNER2, role: "org_owner" }

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

/** Varias sentencias en una sola transaccion (para probar restricciones que necesitan estado). */
async function enTransaccion<T>(
  contexto: Contexto,
  trabajo: (cliente: ClientePostgres) => Promise<T>,
): Promise<T> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    await aplicarContexto(cliente, contexto)
    return await trabajo(cliente)
  } finally {
    await cliente.query("rollback")
  }
}

async function sembrarEscenario(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values
        ('${ORG1}', 'Organizacion Uno'),
        ('${ORG2}', 'Organizacion Dos');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'draft'),
        ('${LOC_C}', '${ORG2}', 'local-c', 'Local C', 'active');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${OWNER1}', '${ORG1}', null, 'owner1@org1.test', 'org_owner', 'Dueno Uno'),
        ('${MANAGER_A}', '${ORG1}', '${LOC_A}', 'manager@org1.test', 'location_manager', 'Encargado A'),
        ('${SERVER_A}', '${ORG1}', '${LOC_A}', 'server@org1.test', 'server', 'Garzon A'),
        ('${OWNER2}', '${ORG2}', null, 'owner2@org2.test', 'org_owner', 'Dueno Dos');

      insert into public.zones (id, location_id, name, kind) values
        ('${ZONE_A}', '${LOC_A}', 'Sala A', 'sala'),
        ('d0000000-0000-0000-0000-000000000003', '${LOC_C}', 'Sala C', 'sala');

      insert into public.tables (location_id, zone_id, label, code) values
        ('${LOC_A}', '${ZONE_A}', 'Mesa A1', '${CODE_A}'),
        ('${LOC_C}', 'd0000000-0000-0000-0000-000000000003', 'Mesa C1', 'ABCDEFGK');
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

describe("Local: quien puede cambiarlo", () => {
  it("debe dejar al dueno actualizar su local", async () => {
    const filas = await conContexto<{ id: string }>(
      CONTEXTO_OWNER1,
      `update public.locations set name = 'Local A renombrado' where id = $1 returning id`,
      [LOC_A],
    )
    expect(filas).toHaveLength(1)
  })

  it("no debe dejar al encargado renombrar el local", async () => {
    const filas = await conContexto<{ id: string }>(
      CONTEXTO_MANAGER_A,
      `update public.locations set name = 'Local A por el encargado' where id = $1 returning id`,
      [LOC_A],
    )
    expect(filas).toHaveLength(0)
  })
})

describe("Zonas: quien puede crearlas", () => {
  it("debe dejar al encargado crear una zona en su local", async () => {
    const filas = await conContexto<{ id: string }>(
      CONTEXTO_MANAGER_A,
      `insert into public.zones (location_id, name, kind) values ($1, 'Terraza A', 'terraza') returning id`,
      [LOC_A],
    )
    expect(filas).toHaveLength(1)
  })

  it("no debe dejar al camarero crear una zona", async () => {
    await expect(
      conContexto(
        CONTEXTO_SERVER_A,
        `insert into public.zones (location_id, name, kind) values ($1, 'Patio A', 'terraza')`,
        [LOC_A],
      ),
    ).rejects.toThrow()
  })

  it("no debe dejar al dueno de otra organizacion crear una zona ajena", async () => {
    await expect(
      conContexto(
        CONTEXTO_OWNER2,
        `insert into public.zones (location_id, name, kind) values ($1, 'Intrusa', 'sala')`,
        [LOC_A],
      ),
    ).rejects.toThrow()
  })

  it("no debe dejar ver las zonas de otra organizacion", async () => {
    expect(await contar(CONTEXTO_OWNER2, "zones")).toBe(1)
    expect(await contar(CONTEXTO_MANAGER_A, "zones")).toBe(1)
  })
})

describe("Mesas: codigo unico y roles", () => {
  it("debe rechazar un codigo ya usado en el mismo local", async () => {
    await expect(
      conContexto(
        CONTEXTO_MANAGER_A,
        `insert into public.tables (location_id, zone_id, label, code) values ($1, $2, 'Mesa A2', $3)`,
        [LOC_A, ZONE_A, CODE_A],
      ),
    ).rejects.toThrow()
  })

  it("debe aceptar un codigo nuevo del alfabeto sin caracteres ambiguos", async () => {
    const filas = await conContexto<{ id: string }>(
      CONTEXTO_MANAGER_A,
      `insert into public.tables (location_id, zone_id, label, code) values ($1, $2, 'Mesa A3', 'JKLMNPQR') returning id`,
      [LOC_A, ZONE_A],
    )
    expect(filas).toHaveLength(1)
  })

  it("debe rechazar un codigo con 0, O, 1 o I", async () => {
    await expect(
      conContexto(
        CONTEXTO_MANAGER_A,
        `insert into public.tables (location_id, zone_id, label, code) values ($1, $2, 'Mesa mala', 'ABCDEFG0')`,
        [LOC_A, ZONE_A],
      ),
    ).rejects.toThrow()
  })

  it("no debe dejar al camarero crear mesas", async () => {
    await expect(
      conContexto(
        CONTEXTO_SERVER_A,
        `insert into public.tables (location_id, zone_id, label, code) values ($1, $2, 'Mesa intrusa', 'QRSTUVWX')`,
        [LOC_A, ZONE_A],
      ),
    ).rejects.toThrow()
  })

  it("no debe dejar ver las mesas de otra organizacion", async () => {
    expect(await contar(CONTEXTO_OWNER2, "tables")).toBe(1)
  })
})

describe("Mesas: posicion en la cuadricula (migracion 0017)", () => {
  it("debe rechazar una posicion negativa", async () => {
    await expect(
      conContexto(
        CONTEXTO_MANAGER_A,
        `insert into public.tables (location_id, zone_id, label, code, pos_fila, pos_columna)
         values ($1, $2, 'Negativa', 'MNPQRSTU', -1, 0)`,
        [LOC_A, ZONE_A],
      ),
    ).rejects.toThrow()
  })

  it("debe rechazar media posicion", async () => {
    await expect(
      conContexto(
        CONTEXTO_MANAGER_A,
        `insert into public.tables (location_id, zone_id, label, code, pos_fila, pos_columna)
         values ($1, $2, 'A medias', 'MNPQRSTU', 1, null)`,
        [LOC_A, ZONE_A],
      ),
    ).rejects.toThrow()
  })

  it("debe rechazar dos mesas en la misma celda de una zona", async () => {
    await expect(
      enTransaccion(CONTEXTO_MANAGER_A, async (cliente) => {
        await cliente.query(
          `insert into public.tables (location_id, zone_id, label, code, pos_fila, pos_columna)
           values ($1, $2, 'Celda 1', 'MNPQRSTU', 5, 5)`,
          [LOC_A, ZONE_A],
        )
        await cliente.query(
          `insert into public.tables (location_id, zone_id, label, code, pos_fila, pos_columna)
           values ($1, $2, 'Celda 2', 'VWXYZ234', 5, 5)`,
          [LOC_A, ZONE_A],
        )
      }),
    ).rejects.toThrow()
  })

  it("debe permitir la misma celda en zonas distintas", async () => {
    const total = await enTransaccion(CONTEXTO_MANAGER_A, async (cliente) => {
      const zonaB = await cliente.query<{ id: string }>(
        `insert into public.zones (location_id, name, kind) values ($1, 'Barra A', 'barra') returning id`,
        [LOC_A],
      )
      const zonaId = zonaB.rows[0]?.id
      if (zonaId === undefined) {
        throw new Error("La zona nueva no devolvio id")
      }
      await cliente.query(
        `insert into public.tables (location_id, zone_id, label, code, pos_fila, pos_columna)
         values ($1, $2, 'Celda A', 'MNPQRSTU', 7, 7)`,
        [LOC_A, ZONE_A],
      )
      await cliente.query(
        `insert into public.tables (location_id, zone_id, label, code, pos_fila, pos_columna)
         values ($1, $2, 'Celda B', 'VWXYZ234', 7, 7)`,
        [LOC_A, zonaId],
      )
      const filas = await cliente.query<{ n: number }>(
        `select count(*)::int as n from public.tables where location_id = $1 and pos_fila = 7 and pos_columna = 7`,
        [LOC_A],
      )
      return filas.rows[0]?.n ?? -1
    })
    expect(total).toBe(2)
  })
})
