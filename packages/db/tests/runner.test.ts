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
import { consultar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

let entorno: EntornoDePruebas | undefined

function parametrosApp(): ParametrosConexion {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return entorno.parametros.app
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
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

  it("debe haber aplicado la migracion de prueba con su fila", async () => {
    const filas = await consultar<{ id: number; descripcion: string }>(
      parametrosApp(),
      "select id, descripcion from prueba_runner",
    )
    expect(filas).toHaveLength(1)
    expect(filas[0]?.descripcion).toBe("Fila insertada por la migracion de prueba del runner")
  })

  it("no debe ser camarero_app el propietario de la tabla de prueba", async () => {
    const filas = await consultar<{ propietario: string }>(
      parametrosApp(),
      "select tableowner as propietario from pg_tables where schemaname = 'public' and tablename = 'prueba_runner'",
    )
    expect(filas[0]?.propietario).not.toBe("camarero_app")
    expect(filas[0]?.propietario).toBe("camarero_owner")
  })

  it("no debe tener camarero_app BYPASSRLS", async () => {
    const filas = await consultar<{ bypass: boolean }>(
      parametrosApp(),
      "select rolbypassrls as bypass from pg_roles where rolname = 'camarero_app'",
    )
    expect(filas[0]?.bypass).toBe(false)
  })
})
