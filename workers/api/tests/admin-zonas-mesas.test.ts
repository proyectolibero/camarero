/**
 * Trozo 2 — Zonas y mesas.
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. La cerradura de
 * verdad (RLS) se prueba contra Postgres en `packages/db`; aqui se comprueba que la pantalla
 * decide bien (formulario o solo lectura, 403 o 303) y que la validacion es del servidor.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { AlmacenPanel, Mesa, NuevaMesa, NuevaZona, Zona } from "../src/panel/datos.ts"
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

const ENCARGADO: Empleado = {
  ...DUENO,
  staffId: "s2",
  nombre: "Encargado",
  rol: "location_manager",
}
const CAMARERO: Empleado = { ...DUENO, staffId: "s3", nombre: "Garzón", rol: "server" }

const ZONA_TERRAZA: Zona = { id: "z1", nombre: "Terraza", kind: "terraza", mesas: 1 }
const MESA_TERRAZA: Mesa = {
  id: "m1",
  codigo: "ABCDEFGH",
  etiqueta: "Terraza 4",
  capacidad: 4,
  kind: "mesa",
  activa: true,
  zonaId: "z1",
  zonaNombre: "Terraza",
  posFila: 0,
  posColumna: 0,
}
const MESA_SUELTA: Mesa = {
  id: "m2",
  codigo: "JKLMNPQR",
  etiqueta: "Barra 1",
  capacidad: 2,
  kind: "barra",
  activa: false,
  zonaId: null,
  zonaNombre: null,
  posFila: 0,
  posColumna: 1,
}

type EspiaZonas = {
  readonly almacen: AlmacenPanel
  readonly creadas: NuevaZona[]
}

function espiaZonas(zonas: readonly Zona[], crearZona?: AlmacenPanel["crearZona"]): EspiaZonas {
  const creadas: NuevaZona[] = []
  const almacen = almacenFalso({
    listarZonas: async () => zonas,
    crearZona:
      crearZona ??
      (async (_empleado, datos) => {
        creadas.push(datos)
        return { ok: true, valor: undefined }
      }),
  })
  return { almacen, creadas }
}

type EspiaMesas = {
  readonly almacen: AlmacenPanel
  readonly creadas: NuevaMesa[]
  readonly alternadas: string[]
}

function espiaMesas(
  mesas: readonly Mesa[],
  opciones: {
    readonly crearMesa?: AlmacenPanel["crearMesa"]
    readonly alternarMesa?: AlmacenPanel["alternarMesa"]
  } = {},
): EspiaMesas {
  const creadas: NuevaMesa[] = []
  const alternadas: string[] = []
  const almacen = almacenFalso({
    listarMesas: async () => mesas,
    listarZonas: async () => [ZONA_TERRAZA],
    crearMesa:
      opciones.crearMesa ??
      (async (_empleado, datos) => {
        creadas.push(datos)
        return { ok: true, valor: { ...MESA_SUELTA, ...datos, id: "m3", codigo: "STUVWXYZ" } }
      }),
    alternarMesa:
      opciones.alternarMesa ??
      (async (_empleado, mesaId) => {
        alternadas.push(mesaId)
        return { ok: true, valor: undefined }
      }),
  })
  return { almacen, creadas, alternadas }
}

function deps(almacen: AlmacenPanel, empleado: Empleado | null): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    autenticar: async () => null,
    resolverEmpleado: async () => empleado,
    almacen,
  }
}

async function conSesion(
  ruta: string,
  opciones: { method?: string; formulario?: Record<string, string> } = {},
) {
  return peticion(ruta, { ...opciones, cookie: await firmante.tokenPara("u1") })
}

describe("Zonas: acceso y formulario", () => {
  it("debe llevar a la entrada sin sesion", async () => {
    const { almacen } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(peticion("/admin/zonas"), ENTORNO, AHORA, deps(almacen, null))
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('action="/admin/entrar"')
  })

  it("debe mostrar el formulario y la lista al dueno", async () => {
    const { almacen } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/zonas"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/admin/zonas"')
    expect(cuerpo).toContain("Terraza")
    expect(cuerpo).toContain("Crear zona")
  })

  it("debe mostrar solo lectura al camarero, sin formulario", async () => {
    const { almacen } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/zonas"),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Terraza")
    expect(cuerpo).not.toContain("Crear zona")
    expect(cuerpo).not.toContain('name="nombre"')
  })
})

describe("Zonas: crear", () => {
  it("debe crear una zona y redirigir", async () => {
    const { almacen, creadas } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/zonas", {
        method: "POST",
        formulario: { nombre: "Barra", tipo: "barra" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/zonas?creada=1")
    expect(creadas).toEqual([{ nombre: "Barra", kind: "barra" }])
  })

  it("debe dejar crear al encargado", async () => {
    const { almacen, creadas } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/zonas", {
        method: "POST",
        formulario: { nombre: "Sala", tipo: "sala" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, ENCARGADO),
    )
    expect(respuesta.status).toBe(303)
    expect(creadas).toHaveLength(1)
  })

  it("no debe aceptar un tipo de zona fuera del check", async () => {
    const { almacen, creadas } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/zonas", {
        method: "POST",
        formulario: { nombre: "Patio", tipo: "patio" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("tipo de zona no es válido")
    expect(creadas).toHaveLength(0)
  })

  it("debe explicar un nombre repetido con un 409", async () => {
    const { almacen } = espiaZonas([ZONA_TERRAZA], async () => ({ ok: false, motivo: "conflicto" }))
    const respuesta = await manejar(
      await conSesion("/admin/zonas", {
        method: "POST",
        formulario: { nombre: "Terraza", tipo: "terraza" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("ya existe")
  })

  it("no debe dejar crear al camarero", async () => {
    const { almacen, creadas } = espiaZonas([ZONA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/zonas", {
        method: "POST",
        formulario: { nombre: "Sala", tipo: "sala" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
    expect(creadas).toHaveLength(0)
  })
})

describe("Mesas: acceso y listado", () => {
  it("debe llevar a la entrada sin sesion", async () => {
    const { almacen } = espiaMesas([MESA_TERRAZA])
    const respuesta = await manejar(peticion("/admin/mesas"), ENTORNO, AHORA, deps(almacen, null))
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('action="/admin/entrar"')
  })

  it("debe listar las mesas agrupadas por zona, con su codigo", async () => {
    const { almacen } = espiaMesas([MESA_TERRAZA, MESA_SUELTA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("ABCDEFGH")
    expect(cuerpo).toContain("JKLMNPQR")
    expect(cuerpo).toContain("<h3>Terraza</h3>")
    expect(cuerpo).toContain("<h3>Sin zona</h3>")
    expect(cuerpo).toContain('action="/admin/mesas"')
  })
})

describe("Mesas: crear", () => {
  it("debe crear una mesa y redirigir", async () => {
    const { almacen, creadas } = espiaMesas([MESA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas", {
        method: "POST",
        formulario: { etiqueta: "Terraza 5", zona: "z1", capacidad: "4", tipo: "mesa" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/mesas?creada=1")
    expect(creadas).toEqual([{ etiqueta: "Terraza 5", zonaId: "z1", capacidad: 4, kind: "mesa" }])
  })

  it("debe aceptar una mesa sin zona", async () => {
    const { almacen, creadas } = espiaMesas([])
    const respuesta = await manejar(
      await conSesion("/admin/mesas", {
        method: "POST",
        formulario: { etiqueta: "Barra 1", zona: "", capacidad: "2", tipo: "barra" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(creadas[0]?.zonaId).toBeNull()
  })

  it("no debe aceptar una capacidad fuera de rango", async () => {
    const { almacen, creadas } = espiaMesas([])
    const respuesta = await manejar(
      await conSesion("/admin/mesas", {
        method: "POST",
        formulario: { etiqueta: "Mesa", zona: "", capacidad: "0", tipo: "mesa" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(creadas).toHaveLength(0)
  })

  it("no debe aceptar una zona que no es del local", async () => {
    const { almacen, creadas } = espiaMesas([])
    const respuesta = await manejar(
      await conSesion("/admin/mesas", {
        method: "POST",
        formulario: { etiqueta: "Mesa", zona: "z-ajena", capacidad: "2", tipo: "mesa" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("no existe en tu local")
    expect(creadas).toHaveLength(0)
  })

  it("no debe dejar crear al camarero", async () => {
    const { almacen, creadas } = espiaMesas([])
    const respuesta = await manejar(
      await conSesion("/admin/mesas", {
        method: "POST",
        formulario: { etiqueta: "Mesa", zona: "", capacidad: "2", tipo: "mesa" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
    expect(creadas).toHaveLength(0)
  })
})

describe("Mesas: alternar", () => {
  it("debe activar o desactivar y redirigir", async () => {
    const { almacen, alternadas } = espiaMesas([MESA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/mesas?cambiada=1")
    expect(alternadas).toEqual(["m1"])
  })

  it("no debe admitir GET en alternar", async () => {
    const { almacen } = espiaMesas([MESA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/alternar"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })

  it("no debe dejar alternar al camarero", async () => {
    const { almacen, alternadas } = espiaMesas([MESA_TERRAZA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
    expect(alternadas).toHaveLength(0)
  })

  it("debe responder 404 si la mesa ya no existe", async () => {
    const { almacen } = espiaMesas([], {
      alternarMesa: async () => ({ ok: false, motivo: "no_existe" }),
    })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m9/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(404)
  })
})
