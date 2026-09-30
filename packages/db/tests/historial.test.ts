/**
 * Historial de migraciones y limpieza del esquema.
 *
 * Cubre tres cosas que la limpieza de F0-10 tiene que dejar demostradas:
 *
 *  1. Aplicar el esquema desde cero ya NO crea `prueba_runner`: esa tabla era del runner de
 *     pruebas, no del producto, y su creacion se movio a `runner.test.ts`.
 *  2. El historial sigue permitiendo repetir la instalacion: en una base con esquema previo y
 *     sin historial, la linea base lo anota sin reaplicar nada, y una segunda ejecucion no
 *     encuentra nada pendiente.
 *  3. `public.camarero_migraciones` no es legible por `anon`, `authenticated` ni
 *     `service_role`: el aprovisionamiento les retira el uso del esquema y sus privilegios.
 *
 * El historial se queda en `public` a proposito. Moverlo a un esquema nuevo dejaria la linea
 * base vacia en una base ya instalada y esta marcaria la migracion de limpieza como aplicada
 * SIN ejecutarla, dejando `prueba_runner` justo donde no queremos. `public` es el esquema que
 * Supabase expone a su API, asi que la proteccion se resuelve con permisos, y se prueba.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { aplicarMigraciones } from "../scripts/aplicar-migraciones.ts"
import { contenedoresConNombre } from "../scripts/levantar-base.ts"
import { asegurarRolDeAplicacion } from "../scripts/preparar-roles.ts"
import type { ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar, consultar } from "../src/conexion.ts"
import { USUARIO_APP } from "../src/configuracion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const REGISTRO = "public.camarero_migraciones"
const ROLES_PUBLICOS = ["anon", "authenticated", "service_role"] as const
const CONTRASENA_ROL_PUBLICO = "clave_de_prueba_no_real"

let entorno: EntornoDePruebas | undefined

function parametros(): EntornoDePruebas {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return entorno
}

/** Autor del historial: el mismo rol que en produccion, el administrador (postgres). */
function admin(): ParametrosConexion {
  return parametros().parametros.admin
}

async function comoAdmin(sql: string): Promise<void> {
  const cliente = await conectar(admin())
  try {
    await cliente.query(sql)
  } finally {
    await cerrar(cliente)
  }
}

async function tieneLectura(rol: string): Promise<boolean> {
  const filas = await consultar<{ puede: boolean }>(
    admin(),
    `select has_table_privilege('${rol}', '${REGISTRO}', 'SELECT') as puede`,
  )
  return filas[0]?.puede === true
}

/** Intento real de lectura, no solo el catalogo: conecta como el rol y hace un SELECT. */
async function puedeLeerDeVerdad(rol: string): Promise<boolean> {
  const cliente = await conectar({ ...admin(), user: rol, password: CONTRASENA_ROL_PUBLICO })
  try {
    await cliente.query(`select 1 from ${REGISTRO} limit 1`)
    return true
  } catch {
    return false
  } finally {
    await cerrar(cliente)
  }
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
}, 240_000)

afterAll(() => {
  if (entorno === undefined) {
    return
  }
  entorno.detener()
  expect(contenedoresConNombre(entorno.nombreDelContenedor)).toEqual([])
})

describe("Esquema limpio desde cero", () => {
  it("no debe crear la tabla de pruebas del runner al aplicar las migraciones", async () => {
    const filas = await consultar<{ ausente: boolean }>(
      admin(),
      "select to_regclass('public.prueba_runner') is null as ausente",
    )
    expect(filas[0]?.ausente).toBe(true)
  })
})

describe("Linea base del historial", () => {
  it("debe anotar el esquema previo sin reaplicar migraciones", async () => {
    const aplicadas = await aplicarMigraciones(admin(), undefined, { registro: REGISTRO })
    expect(aplicadas).toEqual([])
    const filas = await consultar<{ n: number }>(
      admin(),
      `select count(*)::int as n from ${REGISTRO}`,
    )
    expect(filas[0]?.n).toBeGreaterThan(0)
  })

  it("no debe tener migraciones pendientes en una segunda ejecucion", async () => {
    const aplicadas = await aplicarMigraciones(admin(), undefined, { registro: REGISTRO })
    expect(aplicadas).toEqual([])
  })
})

describe("Acceso de los roles publicos de Supabase al historial", () => {
  beforeAll(async () => {
    await comoAdmin(`
      create role anon login password '${CONTRASENA_ROL_PUBLICO}';
      create role authenticated login password '${CONTRASENA_ROL_PUBLICO}';
      create role service_role login bypassrls password '${CONTRASENA_ROL_PUBLICO}';
    `)
  })

  it("debe dejar a anon, authenticated y service_role sin poder leer el historial", async () => {
    // Se simula el estado de Supabase: los tres roles tienen uso del esquema y acceso a las
    // tablas. Sin esto la prueba seria vacua (negar algo que nunca se concedio no prueba nada).
    await comoAdmin(`
      grant usage on schema public to anon, authenticated, service_role;
      grant all on all tables in schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `)
    for (const rol of ROLES_PUBLICOS) {
      expect(await tieneLectura(rol), `${rol} deberia tener acceso antes`).toBe(true)
    }

    // El mismo aprovisionamiento que corre en la instalacion real.
    await asegurarRolDeAplicacion(admin(), USUARIO_APP, null)

    for (const rol of ROLES_PUBLICOS) {
      expect(await tieneLectura(rol), `${rol} conserva SELECT sobre el historial`).toBe(false)
      expect(await puedeLeerDeVerdad(rol), `${rol} ha podido leer el historial`).toBe(false)
    }

    // Y un historial creado despues tampoco queda expuesto: la revocacion tambien alcanza a
    // los privilegios por defecto. Es lo que protege una reinstalacion.
    await comoAdmin(`drop table ${REGISTRO}`)
    await aplicarMigraciones(admin(), undefined, { registro: REGISTRO })
    for (const rol of ROLES_PUBLICOS) {
      expect(await puedeLeerDeVerdad(rol), `${rol} ha podido leer el historial recreado`).toBe(
        false,
      )
    }
  })
})
