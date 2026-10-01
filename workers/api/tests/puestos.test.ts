/**
 * Los puestos del local en el panel (`/admin/puestos`, TASK-F1-09).
 *
 * Hasta ahora las rutas existian sin una sola prueba. Aqui se ejercita el enrutador completo:
 * crear, nombrar, ordenar, activar y marcar «nace aceptado», ademas de los caminos de error y
 * el aislamiento por sesion. La cerradura real es la RLS (se prueba contra Postgres en
 * `packages/db`); aqui se comprueba que cada ruta llama al almacen con lo que debe y responde.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { manejar } from "../src/enrutador.ts"
import type { NuevaPuesto, Puesto } from "../src/panel/datos.ts"
import { AHORA, almacenFalso, crearFirmante, ENTORNO, type Firmante, peticion } from "./apoyo.ts"

const DUENO: Empleado = {
  staffId: "s1",
  correo: "duena@camarero.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Restaurante de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const GARZON: Empleado = { ...DUENO, staffId: "s2", nombre: "Garzón", rol: "server" }

const PUESTOS: readonly Puesto[] = [
  { id: "p1", nombre: "Parrilla", orden: 0, activo: true, autoAcepta: false, porDefecto: false },
  { id: "p2", nombre: "Barra", orden: 1, activo: true, autoAcepta: true, porDefecto: false },
  { id: "p3", nombre: "Cocina", orden: 2, activo: true, autoAcepta: false, porDefecto: true },
]

let firmante: Firmante

beforeAll(async () => {
  firmante = await crearFirmante()
})

async function token(): Promise<string> {
  return firmante.tokenPara("u1")
}

function deps(empleado: Empleado | null, almacen = almacenFalso()) {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    resolverEmpleado: async () => empleado,
    almacen,
  }
}

async function conSesion(
  ruta: string,
  opciones: { readonly method?: string; readonly formulario?: Record<string, string> } = {},
): Promise<Request> {
  return peticion(ruta, { ...opciones, cookie: await token() })
}

describe("Puestos: la lista y el alta", () => {
  it("debe listar los puestos del local y distinguir el que nace aceptado", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/puestos"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ listarPuestos: async () => PUESTOS })),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Parrilla")
    expect(cuerpo).toContain("Barra")
    expect(cuerpo).toContain("Nace aceptado")
    expect(cuerpo).toContain("Espera aprobación")
  })

  it("debe crear un puesto con su nombre y su marca de auto-aceptado", async () => {
    let visto: { empleado: Empleado; datos: NuevaPuesto } | null = null
    const respuesta = await manejar(
      await conSesion("/admin/puestos", {
        method: "POST",
        formulario: { nombre: "Plancha", auto_acepta: "1" },
      }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          crearPuesto: async (empleado, datos) => {
            visto = { empleado, datos }
            return {
              ok: true,
              valor: {
                id: "p9",
                nombre: datos.nombre,
                orden: 9,
                activo: true,
                autoAcepta: datos.autoAcepta,
                porDefecto: false,
              },
            }
          },
        }),
      ),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/puestos?creado=1")
    expect(visto).toEqual({ empleado: DUENO, datos: { nombre: "Plancha", autoAcepta: true } })
  })

  it("debe crear un puesto que espera aprobacion si no se marca la casilla", async () => {
    let visto: NuevaPuesto | null = null
    await manejar(
      await conSesion("/admin/puestos", { method: "POST", formulario: { nombre: "Postre" } }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          crearPuesto: async (_empleado, datos) => {
            visto = datos
            return {
              ok: true,
              valor: { id: "p9", orden: 9, activo: true, porDefecto: false, ...datos },
            }
          },
        }),
      ),
    )
    expect(visto).toEqual({ nombre: "Postre", autoAcepta: false })
  })

  it("no debe crear un puesto sin nombre", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/puestos", { method: "POST", formulario: { nombre: "  " } }),
      ENTORNO,
      AHORA,
      deps(DUENO),
    )
    expect(respuesta.status).toBe(400)
  })

  it("debe explicar un nombre de puesto repetido como conflicto", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/puestos", { method: "POST", formulario: { nombre: "Barra" } }),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ crearPuesto: async () => ({ ok: false, motivo: "conflicto" }) })),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("ya existe otro puesto")
  })
})

describe("Puestos: nombrar, ordenar, activar y auto-aceptar", () => {
  it("debe renombrar un puesto y volver al panel", async () => {
    let visto: { id: string; nombre: string } | null = null
    const respuesta = await manejar(
      await conSesion("/admin/puestos/p1/renombrar", {
        method: "POST",
        formulario: { nombre: "Parrilla de carbón" },
      }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          renombrarPuesto: async (_empleado, id, nombre) => {
            visto = { id, nombre }
            return { ok: true, valor: undefined }
          },
        }),
      ),
    )
    expect(visto).toEqual({ id: "p1", nombre: "Parrilla de carbón" })
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/puestos?cambiado=1")
  })

  it("debe ordenar un puesto hacia arriba y hacia abajo", async () => {
    const direcciones: string[] = []
    const almacen = almacenFalso({
      moverPuesto: async (_empleado, _id, direccion) => {
        direcciones.push(direccion)
        return { ok: true, valor: undefined }
      },
    })
    for (const direccion of ["subir", "bajar"]) {
      const respuesta = await manejar(
        await conSesion("/admin/puestos/p1/mover", { method: "POST", formulario: { direccion } }),
        ENTORNO,
        AHORA,
        deps(DUENO, almacen),
      )
      expect(respuesta.status).toBe(303)
    }
    expect(direcciones).toEqual(["subir", "bajar"])
  })

  it("no debe aceptar una direccion de orden inventada", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/puestos/p1/mover", {
        method: "POST",
        formulario: { direccion: "izquierda" },
      }),
      ENTORNO,
      AHORA,
      deps(DUENO),
    )
    expect(respuesta.status).toBe(400)
  })

  it("debe alternar activo y desactivado", async () => {
    let visto: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/puestos/p1/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          alternarPuesto: async (_empleado, id) => {
            visto = id
            return { ok: true, valor: undefined }
          },
        }),
      ),
    )
    expect(visto).toBe("p1")
    expect(respuesta.status).toBe(303)
  })

  it("debe alternar el nace aceptado de un puesto", async () => {
    let visto: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/puestos/p2/auto", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          alternarAutoAcepta: async (_empleado, id) => {
            visto = id
            return { ok: true, valor: undefined }
          },
        }),
      ),
    )
    expect(visto).toBe("p2")
    expect(respuesta.status).toBe(303)
  })
})

describe("Puestos: cerraduras y metodos", () => {
  it("no debe admitir GET en las acciones: toda mutacion es POST", async () => {
    for (const ruta of [
      "/admin/puestos/p1/renombrar",
      "/admin/puestos/p1/mover",
      "/admin/puestos/p1/alternar",
      "/admin/puestos/p1/auto",
    ]) {
      const respuesta = await manejar(await conSesion(ruta), ENTORNO, AHORA, deps(DUENO))
      expect(respuesta.status).toBe(405)
      expect(respuesta.headers.get("allow")).toBe("POST")
    }
  })

  it("sin sesion no debe crear ni tocar puestos", async () => {
    const lectura = await manejar(peticion("/admin/puestos"), ENTORNO, AHORA, deps(null))
    expect(lectura.status).toBe(200)
    expect(await lectura.text()).toContain('action="/admin/entrar"')
    const mutacion = await manejar(
      peticion("/admin/puestos/p1/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(null),
    )
    expect(mutacion.status).toBe(401)
  })

  it("un empleado sin permiso no debe crear ni cambiar puestos", async () => {
    const almacen = almacenFalso({
      listarPuestos: async () => PUESTOS,
      crearPuesto: async () => ({ ok: true, valor: PUESTOS[0] as Puesto }),
    })
    const alta = await manejar(
      await conSesion("/admin/puestos", { method: "POST", formulario: { nombre: "Plancha" } }),
      ENTORNO,
      AHORA,
      deps(GARZON, almacen),
    )
    expect(alta.status).toBe(403)
    const cambio = await manejar(
      await conSesion("/admin/puestos/p1/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(GARZON, almacen),
    )
    expect(cambio.status).toBe(403)
  })
})
