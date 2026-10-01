/**
 * La cocina: la pantalla de pedidos del local.
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. La cerradura de
 * aislamiento (que un empleado de otro local no ve estas comandas) es de base y se prueba en
 * `packages/db/tests/comanda.test.ts`; aqui se demuestra que la pantalla existe, que una
 * comanda nueva salta a la vista, que acepta y anula por POST y que no ofrece `cerrada`.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import type { DependenciasParciales } from "../src/enrutador.ts"
import { manejar } from "../src/enrutador.ts"
import type { ComandaDeCocina } from "../src/panel/datos.ts"
import { AHORA, almacenFalso, crearFirmante, ENTORNO, type Firmante, peticion } from "./apoyo.ts"

const DUENO: Empleado = {
  staffId: "s1",
  correo: "duena@camarero.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Restaurante de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const COCINA: Empleado = { ...DUENO, staffId: "s2", nombre: "Cocinero", rol: "kitchen" }

const COMANDAS: readonly ComandaDeCocina[] = [
  {
    id: "o1",
    mesa: "Mesa 4",
    estado: "pendiente",
    creadaHaceSegundos: 5,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2, totalClp: 17800 }],
    totalClp: 17800,
  },
  {
    id: "o2",
    mesa: "Barra 2",
    estado: "preparando",
    creadaHaceSegundos: 120,
    lineas: [{ nombre: "Empanada de queso", cantidad: 1, totalClp: 5000 }],
    totalClp: 5000,
  },
]

let firmante: Firmante
beforeAll(async () => {
  firmante = await crearFirmante()
})

function deps(empleado: Empleado | null, almacen = almacenFalso()): DependenciasParciales {
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
  return peticion(ruta, { ...opciones, cookie: await firmante.tokenPara("u1") })
}

describe("Cocina: la pantalla de pedidos", () => {
  it("sin sesion no debe mostrar ninguna comanda, solo la entrada", async () => {
    const respuesta = await manejar(peticion("/admin/pedidos"), ENTORNO, AHORA, deps(null))
    const cuerpo = await respuesta.text()
    expect(respuesta.status).toBe(200)
    expect(cuerpo).toContain('action="/admin/entrar"')
    expect(cuerpo).not.toContain("Ceviche clásico")
    expect(cuerpo).not.toContain("Mesa 4")
  })

  it("debe listar las comandas con su mesa, sus lineas y su estado", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos"),
      ENTORNO,
      AHORA,
      deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
    )
    const cuerpo = await respuesta.text()
    expect(respuesta.status).toBe(200)
    expect(cuerpo).toContain("Mesa 4")
    expect(cuerpo).toContain("Barra 2")
    expect(cuerpo).toContain("2× Ceviche clásico")
    expect(cuerpo).toContain("17.800")
  })

  it("debe hacer que la comanda nueva salte a la vista", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos"),
      ENTORNO,
      AHORA,
      deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("pedido-cocina-pendiente")
    expect(cuerpo).toContain("Comanda nueva")
  })

  it("debe refrescarse sola, declarado en la pagina", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos"),
      ENTORNO,
      AHORA,
      deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
    )
    expect(await respuesta.text()).toContain('http-equiv="refresh" content="15"')
  })

  it("debe decir cuando no hay pedidos abiertos", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos"),
      ENTORNO,
      AHORA,
      deps(COCINA, almacenFalso({ listarComandas: async () => [] })),
    )
    expect(await respuesta.text()).toContain("No hay pedidos abiertos")
  })
})

describe("Cocina: aceptar, marcar lista y anular", () => {
  it("debe aceptar y volver a la lista de pedidos", async () => {
    let visto: { readonly id: string; readonly destino: string } | null = null
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "aceptada" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        almacenFalso({
          cambiarEstadoComanda: async (_empleado, id, destino) => {
            visto = { id, destino }
            return { ok: true, valor: { estado: destino } }
          },
        }),
      ),
    )
    expect(visto).toEqual({ id: "o1", destino: "aceptada" })
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/pedidos?cambiado=1")
  })

  it("debe anular una comanda", async () => {
    let destinoVisto: string | null = null
    await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "anulada" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        almacenFalso({
          cambiarEstadoComanda: async (_empleado, _id, destino) => {
            destinoVisto = destino
            return { ok: true, valor: { estado: destino } }
          },
        }),
      ),
    )
    expect(destinoVisto).toBe("anulada")
  })

  it("no debe admitir un estado fuera de la cocina, como cerrar la cuenta", async () => {
    let llamado = false
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "cerrada" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        almacenFalso({
          cambiarEstadoComanda: async () => {
            llamado = true
            return { ok: false, motivo: "transicion_invalida" }
          },
        }),
      ),
    )
    expect(llamado).toBe(false)
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("no se puede aplicar desde cocina")
  })

  it("debe explicar una transicion no permitida", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o2/estado", {
        method: "POST",
        formulario: { destino: "aceptada" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        almacenFalso({
          cambiarEstadoComanda: async () => ({ ok: false, motivo: "transicion_invalida" }),
          listarComandas: async () => [],
        }),
      ),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("no está permitido")
  })

  it("no debe admitir GET en la accion de estado", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o1/estado"),
      ENTORNO,
      AHORA,
      deps(COCINA),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})

describe("Cocina: el enlace del cuadro de mando", () => {
  it("debe enlazar a los pedidos desde el panel", async () => {
    const respuesta = await manejar(await conSesion("/admin"), ENTORNO, AHORA, deps(DUENO))
    expect(await respuesta.text()).toContain('href="/admin/pedidos"')
  })
})
