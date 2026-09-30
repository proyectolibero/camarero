/**
 * Trozo 3 — Hojas de QR para imprimir.
 *
 * Se comprueba el enrutado y el contenido: el QR se genera en el servidor, el codigo sale en
 * grande y la direccion sale de `DOMINIO_PUBLICO` (nunca escrita a mano). Que el QR ESCANEE
 * se demuestra en `qr.test.ts` con un decodificador independiente.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { AlmacenPanel, Mesa } from "../src/panel/datos.ts"
import { AHORA, almacenFalso, crearFirmante, ENTORNO, type Firmante, peticion } from "./apoyo.ts"

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

const CAMARERO: Empleado = { ...DUENO, staffId: "s2", nombre: "Garzón", rol: "server" }

const MESA: Mesa = {
  id: "m1",
  codigo: "ABCDEFGH",
  etiqueta: "Terraza 4",
  capacidad: 4,
  kind: "mesa",
  activa: true,
  zonaId: null,
  zonaNombre: null,
}

function deps(almacen: AlmacenPanel, empleado: Empleado | null): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    autenticar: async () => null,
    resolverEmpleado: async () => empleado,
    almacen,
  }
}

async function conSesion(ruta: string, opciones: { method?: string } = {}) {
  return peticion(ruta, { ...opciones, cookie: await firmante.tokenPara("u1") })
}

describe("QR: sin sesion", () => {
  it("debe llevar a la entrada en la hoja de una mesa", async () => {
    const almacen = almacenFalso({ leerMesa: async () => MESA })
    const respuesta = await manejar(
      peticion("/admin/mesas/m1/qr"),
      ENTORNO,
      AHORA,
      deps(almacen, null),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/admin/entrar"')
    expect(cuerpo).not.toContain("ABCDEFGH")
  })

  it("debe llevar a la entrada en la hoja de todas las mesas", async () => {
    const almacen = almacenFalso({ listarMesas: async () => [MESA] })
    const respuesta = await manejar(
      peticion("/admin/mesas/qr"),
      ENTORNO,
      AHORA,
      deps(almacen, null),
    )
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('action="/admin/entrar"')
  })
})

describe("QR: dueno", () => {
  it("debe imprimir la hoja de una mesa con codigo y direccion", async () => {
    const almacen = almacenFalso({ leerMesa: async () => MESA })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/qr"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("<svg")
    expect(cuerpo).toContain("ABCDEFGH")
    expect(cuerpo).toContain("https://camarero.proyectolibero.org/t/ABCDEFGH")
  })

  it("debe imprimir la hoja de todas las mesas", async () => {
    const almacen = almacenFalso({ listarMesas: async () => [MESA] })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/qr"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("ABCDEFGH")
    expect(cuerpo).toContain("Terraza 4")
    expect(cuerpo.match(/<svg/g)?.length).toBe(1)
  })

  it("debe explicar que falta el dominio configurado, sin inventar uno", async () => {
    const almacen = almacenFalso({ leerMesa: async () => MESA })
    const sinDominio = { SUPABASE_URL: ENTORNO.SUPABASE_URL }
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/qr"),
      sinDominio,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(503)
    expect(await respuesta.text()).toContain("DOMINIO_PUBLICO")
  })

  it("debe responder 404 si la mesa no existe", async () => {
    const almacen = almacenFalso({ leerMesa: async () => null })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m9/qr"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(404)
  })
})

describe("QR: sin permiso", () => {
  it("no debe dejar imprimir al camarero", async () => {
    const almacen = almacenFalso({ leerMesa: async () => MESA })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/qr"),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
  })
})

describe("QR: metodo", () => {
  it("no debe admitir POST en la hoja de una mesa", async () => {
    const almacen = almacenFalso({ leerMesa: async () => MESA })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/qr", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("GET")
  })
})
