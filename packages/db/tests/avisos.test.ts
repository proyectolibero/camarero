/**
 * Los avisos del comensal y la identidad del local como dato (TASK-F1-13, TASK-F4-01).
 *
 * Se prueba contra la base real y como `camarero_app` (no propietario, sin BYPASSRLS): las
 * cerraduras de verdad son las politicas. Cada prueba hace su escenario COMPLETO dentro de una
 * sola transaccion que se revierte al final, porque el contexto `app.*` es local a la
 * transaccion: si cada paso abriera la suya, el aviso creado no lo veria el siguiente SELECT.
 * El caso feliz y el caso que DEBE fallar van juntos para que ninguna cerradura pase por vacia.
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
const MESA_A2 = "e0000000-0000-0000-0000-000000000002"
const MESA_B1 = "e0000000-0000-0000-0000-000000000003"
const CODIGO_A1 = "ABCDEFGH"
const CODIGO_A2 = "ABCDEFGJ"
const CODIGO_B1 = "ABCDEFGK"
const SES_A1 = "f0000000-0000-0000-0000-000000000001"
const SES_A2 = "f0000000-0000-0000-0000-000000000002"
const SES_B1 = "f0000000-0000-0000-0000-000000000003"
const STAFF_A = "b0000000-0000-0000-0000-000000000001"
const STAFF_B = "b0000000-0000-0000-0000-000000000002"
const OWNER_A = "b0000000-0000-0000-0000-000000000011"

type Contexto = {
  readonly tableCode?: string
  readonly tableId?: string
  readonly locationId?: string
  readonly sessionId?: string
  readonly orgId?: string
  readonly staffId?: string
  readonly role?: string
}

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

/**
 * Ejecuta varias operaciones con contextos DISTINTOS dentro de una sola transaccion, para
 * poder encadenar "el comensal crea, el camarero atiende" y ver el efecto. `pasos` recibe un
 * ejecutor que fija un contexto y hace la consulta. Todo se revierte al final.
 */
async function escenario(
  pasos: (
    hacer: <T extends { [clave: string]: unknown }>(
      contexto: Contexto,
      sql: string,
      valores?: unknown[],
    ) => Promise<{ readonly filas: T[]; readonly filasAfectadas: number; readonly fallo: boolean }>,
  ) => Promise<void>,
): Promise<void> {
  const cliente = clienteApp()
  await cliente.query("begin")
  try {
    const hacer = async <T extends { [clave: string]: unknown }>(
      contexto: Contexto,
      sql: string,
      valores: unknown[] = [],
    ) => {
      // Cada operacion va en su propio savepoint: una escritura que la RLS rechaza aborta la
      // transaccion, y sin esto los pasos siguientes de la misma prueba no podrian ejecutarse.
      await cliente.query("savepoint paso")
      try {
        await aplicarContexto(cliente, contexto)
        const resultado = await cliente.query<T>(sql, valores)
        await cliente.query("release savepoint paso")
        return {
          filas: resultado.rows,
          filasAfectadas: resultado.rowCount ?? 0,
          fallo: false,
        }
      } catch {
        await cliente.query("rollback to savepoint paso")
        return { filas: [] as T[], filasAfectadas: -1, fallo: true }
      }
    }
    await pasos(hacer)
  } finally {
    await cliente.query("rollback")
  }
}

const COMENSAL_A1: Contexto = {
  tableCode: CODIGO_A1,
  tableId: MESA_A1,
  locationId: LOC_A,
  sessionId: SES_A1,
}
const COMENSAL_A2: Contexto = {
  tableCode: CODIGO_A2,
  tableId: MESA_A2,
  locationId: LOC_A,
  sessionId: SES_A2,
}
const CAMARERO_A: Contexto = { orgId: ORG1, staffId: STAFF_A, role: "server", locationId: LOC_A }
const CAMARERO_B: Contexto = { orgId: ORG2, staffId: STAFF_B, role: "server", locationId: LOC_B }
const DUENO_A: Contexto = { orgId: ORG1, staffId: OWNER_A, role: "org_owner" }

const SQL_CREAR = `insert into public.table_notices (session_id, table_id, kind, expires_at)
  values ($1, $2, $3, now() + make_interval(secs => $4::int))`

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
        ('${MESA_B1}', '${LOC_B}', 'Mesa B1', '${CODIGO_B1}');

      insert into public.staff (id, org_id, location_id, email, role, display_name) values
        ('${STAFF_A}', '${ORG1}', '${LOC_A}', 'serverA@camarero.test', 'server', 'Camarero A'),
        ('${STAFF_B}', '${ORG2}', '${LOC_B}', 'serverB@camarero.test', 'server', 'Camarero B'),
        ('${OWNER_A}', '${ORG1}', null, 'ownerA@camarero.test', 'org_owner', 'Dueno A');

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_A1}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A1', 'active'),
        ('${SES_A2}', '${ORG1}', '${LOC_A}', '${MESA_A2}', 'MESA-A2', 'active'),
        ('${SES_B1}', '${ORG2}', '${LOC_B}', '${MESA_B1}', 'MESA-B1', 'active');
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

describe("El comensal pide ayuda y ve que la ha pedido", () => {
  it("debe crear una llamada al empleado en su propia mesa y verla", async () => {
    await escenario(async (hacer) => {
      const creada = await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      expect(creada.filasAfectadas).toBe(1)
      const suyos = await hacer<{ kind: string; state: string }>(
        COMENSAL_A1,
        "select kind, state from public.table_notices where session_id = $1",
        [SES_A1],
      )
      expect(suyos.filas).toEqual([{ kind: "llamar_empleado", state: "pendiente" }])
    })
  })

  it("debe crear el aviso de limpieza, distinto de la llamada", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "necesita_limpieza", 300])
      const suyos = await hacer<{ n: number }>(
        COMENSAL_A1,
        "select count(*)::int as n from public.table_notices where session_id = $1",
        [SES_A1],
      )
      expect(suyos.filas[0]?.n).toBe(2)
    })
  })

  it("no debe dejar crear un aviso de un tipo inventado", async () => {
    await escenario(async (hacer) => {
      const creado = await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "traeme_la_cuenta", 300])
      expect(creado.fallo).toBe(true)
    })
  })
})

describe("El tope: una llamada viva de cada tipo por mesa", () => {
  it("no debe dejar una segunda llamada VIVA del mismo tipo", async () => {
    await escenario(async (hacer) => {
      const primera = await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      expect(primera.filasAfectadas).toBe(1)
      const segunda = await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      expect(segunda.fallo).toBe(true)
      const cuantas = await hacer<{ n: number }>(
        COMENSAL_A1,
        "select count(*)::int as n from public.table_notices where table_id = $1 and kind = 'llamar_empleado'",
        [MESA_A1],
      )
      expect(cuantas.filas[0]?.n).toBe(1)
    })
  })

  it("debe dejar crear otra cuando la anterior ya fue atendida", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      const atendida = await hacer(
        CAMARERO_A,
        `select public.camarero_atender_aviso(id)
           from public.table_notices
          where table_id = $1 and kind = 'llamar_empleado' and state = 'pendiente'`,
        [MESA_A1],
      )
      expect(atendida.filas).toEqual([{ camarero_atender_aviso: "ok" }])
      const nueva = await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      expect(nueva.filasAfectadas).toBe(1)
    })
  })

  it("el aviso de una mesa no bloquea el de otra", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      const otra = await hacer(COMENSAL_A2, SQL_CREAR, [SES_A2, MESA_A2, "llamar_empleado", 300])
      expect(otra.filasAfectadas).toBe(1)
    })
  })
})

describe("El personal ve los avisos con su mesa y su antiguedad, y los puede atender", () => {
  it("debe ver el camarero los de su local y no los de otro", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      const delSuyo = await hacer<{ mesa: string; hace: number; kind: string }>(
        CAMARERO_A,
        `select t.label as mesa, extract(epoch from (now() - n.requested_at))::int as hace, n.kind
           from public.table_notices n join public.tables t on t.id = n.table_id
          where n.state = 'pendiente'`,
      )
      expect(delSuyo.filas).toHaveLength(1)
      expect(delSuyo.filas[0]?.mesa).toBe("Mesa A1")
      expect(delSuyo.filas[0]?.hace).toBeGreaterThanOrEqual(0)

      const delAjeno = await hacer<{ n: number }>(
        CAMARERO_B,
        "select count(*)::int as n from public.table_notices where table_id = $1",
        [MESA_A1],
      )
      expect(delAjeno.filas[0]?.n).toBe(0)
    })
  })

  it("no debe ver el comensal de otra mesa el aviso de una mesa ajena", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      const ajeno = await hacer<{ n: number }>(
        COMENSAL_A2,
        "select count(*)::int as n from public.table_notices where session_id = $1",
        [SES_A1],
      )
      expect(ajeno.filas[0]?.n).toBe(0)
    })
  })

  it("debe poder atenderlo el dueno de la organizacion y desaparecer de la lista", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "necesita_limpieza", 300])
      const atendido = await hacer(
        DUENO_A,
        `select public.camarero_atender_aviso(id)
           from public.table_notices
          where table_id = $1 and kind = 'necesita_limpieza' and state = 'pendiente'`,
        [MESA_A1],
      )
      expect(atendido.filas).toEqual([{ camarero_atender_aviso: "ok" }])
      const pendientes = await hacer<{ n: number }>(
        CAMARERO_A,
        "select count(*)::int as n from public.table_notices where table_id = $1 and state = 'pendiente'",
        [MESA_A1],
      )
      expect(pendientes.filas[0]?.n).toBe(0)
    })
  })

  it("no debe dejar el comensal atender su propio aviso", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      const propio = await hacer(
        COMENSAL_A1,
        "update public.table_notices set state = 'atendida', attended_at = now() where table_id = $1",
        [MESA_A1],
      )
      expect(propio.filasAfectadas).toBe(0)
    })
  })

  it("no debe dejar al camarero de otro local atender un aviso ajeno", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 300])
      const ajeno = await hacer(
        CAMARERO_B,
        `select public.camarero_atender_aviso(id)
           from public.table_notices
          where table_id = $1 and state = 'pendiente'`,
        [MESA_A1],
      )
      // La RLS no le devuelve la fila, de modo que la funcion ni se llama.
      expect(ajeno.filas).toEqual([])
    })
  })

  it("no debe dejar crear un aviso para la mesa de otro local", async () => {
    await escenario(async (hacer) => {
      // El comensal de A1 intenta insertar un aviso con la mesa/sesion de B1.
      const cruzado = await hacer(COMENSAL_A1, SQL_CREAR, [SES_B1, MESA_B1, "llamar_empleado", 300])
      expect(cruzado.fallo).toBe(true)
      // Y con SU sesion pero la mesa de otro: tampoco.
      const mesaAjena = await hacer(COMENSAL_A1, SQL_CREAR, [
        SES_A1,
        MESA_B1,
        "llamar_empleado",
        300,
      ])
      expect(mesaAjena.fallo).toBe(true)
    })
  })
})

describe("Los avisos caducan solos si nadie los atiende", () => {
  it("no debe caducar nada antes de su hora", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "llamar_empleado", 3600])
      const antes = await hacer(
        { orgId: ORG1, role: "platform_admin" },
        "select public.camarero_caducar_avisos(now()) as n",
      )
      expect(antes.filas).toEqual([{ n: 0 }])
    })
  })

  it("debe caducar el aviso al pasar su hora y desaparecer de la lista", async () => {
    await escenario(async (hacer) => {
      await hacer(COMENSAL_A1, SQL_CREAR, [SES_A1, MESA_A1, "necesita_limpieza", 3600])
      const marcados = await hacer(
        { orgId: ORG1, role: "platform_admin" },
        "select public.camarero_caducar_avisos(now() + interval '2 hours') as n",
      )
      expect(marcados.filas).toEqual([{ n: 1 }])
      const pendientes = await hacer<{ n: number }>(
        COMENSAL_A1,
        "select count(*)::int as n from public.table_notices where state = 'pendiente'",
      )
      expect(pendientes.filas[0]?.n).toBe(0)
    })
  })
})

describe("La identidad del local como dato", () => {
  it("debe leer el modelo por defecto cuando el local no ha elegido", async () => {
    await escenario(async (hacer) => {
      const filas = await hacer<{ modelo: string; acento: string | null }>(
        COMENSAL_A1,
        "select public.camarero_modelo_de_local($1) as modelo, public.camarero_acento_de_local($1) as acento",
        [LOC_A],
      )
      expect(filas.filas[0]).toEqual({ modelo: "sobrio", acento: null })
    })
  })

  it("debe guardar el modelo y el acento elegidos y leerlos de vuelta", async () => {
    const admin = await conectar(entorno?.parametros.admin as ParametrosConexion)
    try {
      await admin.query(
        `update public.locations
            set theme_json = '{"modelo":"nocturno","acento":"#b98cf0"}'::jsonb
          where id = $1`,
        [LOC_A],
      )
      const filas = await admin.query<{ modelo: string; acento: string }>(
        "select public.camarero_modelo_de_local($1) as modelo, public.camarero_acento_de_local($1) as acento",
        [LOC_A],
      )
      expect(filas.rows[0]).toEqual({ modelo: "nocturno", acento: "#b98cf0" })
      await admin.query("update public.locations set theme_json = null where id = $1", [LOC_A])
    } finally {
      await cerrar(admin)
    }
  })

  it("no debe aceptar un modelo inventado", async () => {
    const admin = await conectar(entorno?.parametros.admin as ParametrosConexion)
    try {
      await expect(
        admin.query(
          `update public.locations set theme_json = '{"modelo":"chillon"}'::jsonb where id = $1`,
          [LOC_A],
        ),
      ).rejects.toThrow()
    } finally {
      await cerrar(admin)
    }
  })

  it("no debe aceptar un acento que no es hex", async () => {
    const admin = await conectar(entorno?.parametros.admin as ParametrosConexion)
    try {
      await expect(
        admin.query(
          `update public.locations set theme_json = '{"acento":"rojo"}'::jsonb where id = $1`,
          [LOC_A],
        ),
      ).rejects.toThrow()
    } finally {
      await cerrar(admin)
    }
  })

  it("no debe aceptar claves desconocidas en theme_json", async () => {
    const admin = await conectar(entorno?.parametros.admin as ParametrosConexion)
    try {
      await expect(
        admin.query(
          `update public.locations set theme_json = '{"modelo":"sobrio","fuente":"Comic Sans"}'::jsonb where id = $1`,
          [LOC_A],
        ),
      ).rejects.toThrow()
    } finally {
      await cerrar(admin)
    }
  })
})
