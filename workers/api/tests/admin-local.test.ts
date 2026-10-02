/**
 * Trozo 1 — El local: verlo y editarlo.
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. Ninguna prueba
 * sale a la red ni toca Postgres; la RLS real se prueba aparte (`packages/db`).
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { AlmacenPanel, CambiosLocal, DatosLocal, Resultado } from "../src/panel/datos.ts"
import {
  AHORA,
  almacenFalso as crearAlmacen,
  crearFirmante,
  ENTORNO,
  type Firmante,
  peticion,
} from "./apoyo.ts"

let firmante: Firmante

beforeAll(async () => {
  firmante = await crearFirmante()
})

const DUENO: Empleado = {
  staffId: "s1",
  correo: "dueno@prueba.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Organización de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const ENCARGADO: Empleado = {
  ...DUENO,
  staffId: "s2",
  nombre: "Encargado",
  rol: "location_manager",
}

const LOCAL: DatosLocal = {
  id: "l1",
  orgId: "o1",
  nombre: "Barra Uno",
  slug: "barra-uno",
  timezone: "America/Santiago",
  currency: "CLP",
  status: "draft",
  serviceMode: "dine_in",
  modelo: "sobrio",
  acento: null,
  logoClave: null,
  portadaClave: null,
}

type EspiaAlmacen = { readonly almacen: AlmacenPanel; readonly cambios: CambiosLocal[] }

function almacenFalso(local: DatosLocal | null, resultado?: Resultado): EspiaAlmacen {
  const cambios: CambiosLocal[] = []
  const almacen = crearAlmacen({
    leerLocal: async () => local,
    actualizarLocal: async (_empleado, guardados) => {
      cambios.push(guardados)
      return resultado ?? { ok: true, valor: undefined }
    },
  })
  return { almacen, cambios }
}

function deps(almacen: AlmacenPanel, empleado: Empleado | null): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    autenticar: async () => null,
    resolverEmpleado: async () => empleado,
    almacen,
  }
}

const FORMULARIO_VALIDO = {
  nombre: "Barra Uno Renombrada",
  zona_horaria: "America/Santiago",
  estado: "active",
  modo_servicio: "both",
}

describe("El local: sin sesion", () => {
  it("debe llevar a la entrada sin mostrar datos", async () => {
    const { almacen } = almacenFalso(LOCAL)
    const respuesta = await manejar(peticion("/admin/local"), ENTORNO, AHORA, deps(almacen, null))
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/admin/entrar"')
    expect(cuerpo).not.toContain("Barra Uno")
  })

  it("no debe aceptar una mutacion sin sesion", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", { method: "POST", formulario: FORMULARIO_VALIDO }),
      ENTORNO,
      AHORA,
      deps(almacen, null),
    )
    expect(respuesta.status).toBe(401)
    expect(cambios).toHaveLength(0)
  })
})

describe("El local: dueno", () => {
  it("debe mostrar los datos y el formulario editable", async () => {
    const { almacen } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('name="nombre"')
    expect(cuerpo).toContain("Barra Uno")
    expect(cuerpo).toContain("Guardar cambios")
    expect(cuerpo).toContain("CLP")
  })

  it("debe avisar de que pasar a «En servicio» es encender el local", async () => {
    const { almacen } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(await respuesta.text()).toContain("encenderlo por primera vez")
  })

  it("debe guardar y redirigir con el aviso de exito", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: FORMULARIO_VALIDO,
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/local?guardado=1")
    expect(cambios).toEqual([
      {
        nombre: "Barra Uno Renombrada",
        timezone: "America/Santiago",
        status: "active",
        serviceMode: "both",
        modelo: "sobrio",
        acento: null,
        logoClave: null,
        portadaClave: null,
      },
    ])
  })

  it("debe mostrar el aviso de guardado cuando vuelve con ?guardado=1", async () => {
    const { almacen } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local?guardado=1", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(await respuesta.text()).toContain("Cambios guardados.")
  })

  it("no debe guardar un nombre vacio y debe explicarlo", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: { ...FORMULARIO_VALIDO, nombre: "   " },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("no puede quedar vacío")
    expect(cambios).toHaveLength(0)
  })

  it("no debe aceptar una zona horaria inventada", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: { ...FORMULARIO_VALIDO, zona_horaria: "Marte/Olimpo" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("no se reconoce")
    expect(cambios).toHaveLength(0)
  })

  it("no debe aceptar un estado fuera del check", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: { ...FORMULARIO_VALIDO, estado: "abierto" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(cambios).toHaveLength(0)
  })
})

describe("El local: sin permiso", () => {
  it("debe mostrar los datos en solo lectura para el encargado", async () => {
    const { almacen } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, ENCARGADO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Barra Uno")
    expect(cuerpo).not.toContain('name="nombre"')
    expect(cuerpo).not.toContain("Guardar cambios")
  })

  it("no debe dejar editar al encargado", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: FORMULARIO_VALIDO,
      }),
      ENTORNO,
      AHORA,
      deps(almacen, ENCARGADO),
    )
    expect(respuesta.status).toBe(403)
    expect(cambios).toHaveLength(0)
  })

  it("debe dar 403 si la base rechaza la escritura aunque la pantalla la ofrezca", async () => {
    const { almacen, cambios } = almacenFalso(LOCAL, { ok: false, motivo: "sin_permiso" })
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: FORMULARIO_VALIDO,
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(403)
    expect(cambios).toHaveLength(1)
  })
})

describe("El local: metodo", () => {
  it("debe responder 405 a un metodo que no es GET ni POST", async () => {
    const { almacen } = almacenFalso(LOCAL)
    const respuesta = await manejar(
      peticion("/admin/local", { method: "DELETE", cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("GET, POST")
  })
})
