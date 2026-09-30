/**
 * Prueba real del runner: no simula Docker ni PostgreSQL.
 *
 * Todo se ejecuta contra un contenedor efimero y contra el rol de aplicacion
 * `camarero_app`. El `afterAll` para el contenedor y comprueba que no queda ningun
 * huerfano, incluso si algun test ha fallado antes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { contenedoresConNombre } from "../scripts/levantar-base.ts"
import type { ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar, consultar } from "../src/conexion.ts"
import { modoDeBase } from "../src/configuracion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

let entorno: EntornoDePruebas | undefined

function parametrosApp(): ParametrosConexion {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return entorno.parametros.app
}

/**
 * La tabla de pruebas del runner la necesitan ESTAS pruebas, no el esquema del producto: por
 * eso se crea aqui y no viaja en una migracion. El autor es quien creo el esquema (el dueno
 * en local, el administrador en un Postgres gestionado), de modo que la tabla hereda los
 * privilegios por defecto que ese mismo rol ya concedio a `camarero_app`.
 */
async function crearTablaDePruebas(): Promise<void> {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  const autor = modoDeBase() === "local" ? entorno.parametros.owner : entorno.parametros.admin
  const cliente = await conectar(autor)
  try {
    await cliente.query(`
      create table public.prueba_runner (
        id integer primary key,
        descripcion text not null
      );
      insert into public.prueba_runner (id, descripcion)
      values (1, 'Fila insertada por la tabla de pruebas del runner');
    `)
  } finally {
    await cerrar(cliente)
  }
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await crearTablaDePruebas()
}, 180_000)

afterAll(() => {
  if (entorno === undefined) {
    return
  }
  entorno.detener()
  expect(contenedoresConNombre(entorno.nombreDelContenedor)).toEqual([])
})

describe("Runner de base de datos de pruebas", () => {
  it("debe responder a select 1 cuando la base esta levantada", async () => {
    const filas = await consultar<{ uno: number }>(parametrosApp(), "select 1 as uno")
    expect(filas[0]?.uno).toBe(1)
  })

  it("debe haber creado la tabla de pruebas del runner con su fila", async () => {
    const filas = await consultar<{ id: number; descripcion: string }>(
      parametrosApp(),
      "select id, descripcion from prueba_runner",
    )
    expect(filas).toHaveLength(1)
    expect(filas[0]?.descripcion).toBe("Fila insertada por la tabla de pruebas del runner")
  })

  it("no debe ser camarero_app el propietario de la tabla de prueba", async () => {
    const filas = await consultar<{ propietario: string }>(
      parametrosApp(),
      "select tableowner as propietario from pg_tables where schemaname = 'public' and tablename = 'prueba_runner'",
    )
    // Lo que de verdad protege la RLS es que el rol de la aplicacion NO sea el propietario,
    // porque el propietario la ignora. Quien sea el dueno cambia segun el entorno: en local
    // es camarero_owner; en un Postgres gestionado, el administrador que hizo de postgres.
    expect(filas[0]?.propietario).not.toBe("camarero_app")
    const duenoEsperado = modoDeBase() === "local" ? "camarero_owner" : "camarero_admin"
    expect(filas[0]?.propietario).toBe(duenoEsperado)
  })

  it("no debe tener camarero_app BYPASSRLS", async () => {
    const filas = await consultar<{ bypass: boolean }>(
      parametrosApp(),
      "select rolbypassrls as bypass from pg_roles where rolname = 'camarero_app'",
    )
    expect(filas[0]?.bypass).toBe(false)
  })
})
