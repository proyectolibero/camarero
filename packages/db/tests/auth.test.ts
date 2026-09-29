/**
 * Puente entre el inicio de sesion y la RLS: dos credenciales, dos filas, nada mas.
 *
 * Se comprueba que, ANTES de tener identidad de empleado:
 *
 *  - quien presenta un token de Supabase Auth puede leer SU fila de `staff` (y solo la suya);
 *  - quien presenta el token de un dispositivo puede leer SU fila de `staff_devices`;
 *  - sin credencial, no se lee ninguna de las dos.
 *
 * Es el huevo y la gallina del inicio de sesion: sin esto, el borde no puede averiguar quien
 * es nadie. Se conecta como `camarero_app` (nunca el propietario: LL-004).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

// ---------------------------------------------------------------------------
// Escenario
// ---------------------------------------------------------------------------

const ORG1 = "11111111-1111-1111-1111-111111111111"
const ORG2 = "22222222-2222-2222-2222-222222222222"
const STAFF1 = "b0000000-0000-0000-0000-000000000001"
const STAFF2 = "b0000000-0000-0000-0000-000000000002"
const STAFF3 = "b0000000-0000-0000-0000-000000000003"
const AUTH1 = "99aaaaaa-0000-0000-0000-000000000001"
const AUTH2 = "99aaaaaa-0000-0000-0000-000000000002"
const AUTH_DESCONOCIDO = "99aaaaaa-0000-0000-0000-0000000000ff"
const DEVICE1 = "0d000000-0000-0000-0000-000000000001"
const TOKEN1 = "token-de-la-tablet-1"

const COMENSAL = { sessionId: "" }

type Contexto = {
  orgId?: string
  staffId?: string
  role?: string
  sessionId?: string
  deviceAlias?: string
  jwtClaims?: string
  deviceToken?: string
}

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
    ["app.location_id", ""],
    ["app.session_id", contexto.sessionId ?? ""],
    ["app.device_alias", contexto.deviceAlias ?? ""],
    ["app.staff_device_token", contexto.deviceToken ?? ""],
    ["request.jwt.claims", contexto.jwtClaims ?? ""],
  ]
  for (const [clave, valor] of pares) {
    await cliente.query("select set_config($1, $2, true)", [clave, valor])
  }
}

async function conContexto<T extends Record<string, unknown>>(
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

function reclamaciones(authUserId: string): string {
  return JSON.stringify({ sub: authUserId, role: "authenticated" })
}

async function sembrarEscenario(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values
        ('${ORG1}', 'Organizacion Uno'),
        ('${ORG2}', 'Organizacion Dos');

      insert into public.staff (id, org_id, location_id, email, role, display_name, auth_user_id) values
        ('${STAFF1}', '${ORG1}', null, 'dueno1@org1.test', 'org_owner', 'Duena Uno', '${AUTH1}'),
        ('${STAFF2}', '${ORG1}', null, 'camarero1@org1.test', 'server', 'Camarero Uno', '${AUTH2}'),
        ('${STAFF3}', '${ORG2}', null, 'dueno2@org2.test', 'org_owner', 'Duena Dos', null);

      insert into public.staff_devices (id, staff_id, device_token) values
        ('${DEVICE1}', '${STAFF2}', '${TOKEN1}');
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

// ---------------------------------------------------------------------------
// El panel: token de Supabase Auth
// ---------------------------------------------------------------------------

describe("Inicio de sesion del panel: el token da acceso a la propia fila", () => {
  it("debe ver su fila de empleado cuando presenta su token, y solo esa", async () => {
    const filas = await conContexto<{ id: string; org_id: string; role: string }>(
      { jwtClaims: reclamaciones(AUTH1) },
      `select id, org_id, role from public.staff`,
    )
    expect(filas).toHaveLength(1)
    expect(filas[0]?.id).toBe(STAFF1)
    expect(filas[0]?.org_id).toBe(ORG1)
    expect(filas[0]?.role).toBe("org_owner")
  })

  it("no debe ver ninguna fila cuando el token es de un usuario desconocido", async () => {
    const filas = await conContexto(
      { jwtClaims: reclamaciones(AUTH_DESCONOCIDO) },
      `select id from public.staff`,
    )
    expect(filas).toHaveLength(0)
  })

  it("no debe ver ninguna fila cuando no presenta token", async () => {
    const filas = await conContexto({ ...COMENSAL }, `select id from public.staff`)
    expect(filas).toHaveLength(0)
  })

  it("no debe ver la fila de un empleado de otra organizacion aunque conozca su token", async () => {
    // STAFF3 no tiene auth_user_id, asi que ningun token lo hace visible.
    const filas = await conContexto(
      { jwtClaims: reclamaciones(AUTH2) },
      `select id from public.staff`,
    )
    expect(filas.map((f) => f.id)).toEqual([STAFF2])
  })
})

// ---------------------------------------------------------------------------
// La tablet: token de dispositivo + PIN
// ---------------------------------------------------------------------------

describe("Inicio de sesion del dispositivo: el token de la tablet da acceso a su fila", () => {
  it("debe ver su fila de dispositivo cuando presenta su token", async () => {
    const filas = await conContexto<{ id: string; staff_id: string }>(
      { deviceToken: TOKEN1 },
      `select id, staff_id from public.staff_devices`,
    )
    expect(filas).toHaveLength(1)
    expect(filas[0]?.id).toBe(DEVICE1)
    expect(filas[0]?.staff_id).toBe(STAFF2)
  })

  it("no debe ver ninguna fila cuando no presenta token de dispositivo", async () => {
    const filas = await conContexto({ ...COMENSAL }, `select id from public.staff_devices`)
    expect(filas).toHaveLength(0)
  })

  it("no debe ver ninguna fila con un token de dispositivo que no existe", async () => {
    const filas = await conContexto(
      { deviceToken: "token-inventado" },
      `select id from public.staff_devices`,
    )
    expect(filas).toHaveLength(0)
  })
})
