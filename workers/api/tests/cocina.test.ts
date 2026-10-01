/**
 * Las pantallas de puesto: cocina, barra y todo (`GET /admin/pedidos[/<puesto>]`).
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. La cerradura de
 * aislamiento (que un empleado de otro local no ve estas comandas) es de base y se prueba en
 * `packages/db`; aqui se demuestra que cada ruta sirve su puesto, que la pantalla NO ensena
 * precios, que una comanda nueva salta a la vista, que acepta y anula por POST y que no
 * ofrece `cerrada`.
 */

import { destinosDelPuesto, type PuestoDePantalla } from "@camarero/domain"
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import type { DependenciasParciales } from "../src/enrutador.ts"
import { manejar } from "../src/enrutador.ts"
import type { ComandaDePuesto } from "../src/panel/datos.ts"
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

const COMANDAS: readonly ComandaDePuesto[] = [
  {
    id: "o1",
    mesa: "Mesa 4",
    destino: "frio",
    estado: "pendiente",
    creadaHaceSegundos: 5,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2 }],
  },
  {
    id: "o2",
    mesa: "Barra 2",
    destino: "bebidas",
    estado: "aceptada",
    creadaHaceSegundos: 30,
    lineas: [{ nombre: "Agua mineral", cantidad: 1 }],
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

describe("Puestos: cada ruta sirve su pantalla", () => {
  it("sin puesto en la ruta debe servir cocina", async () => {
    let puestoVisto: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/pedidos"),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        almacenFalso({
          listarComandas: async (_empleado, puesto) => {
            puestoVisto = puesto
            return COMANDAS
          },
        }),
      ),
    )
    expect(puestoVisto).toBe("cocina")
    expect(await respuesta.text()).toContain("Pedidos de cocina")
  })

  it("debe servir la barra y el todo por su ruta", async () => {
    const vistos: string[] = []
    const almacen = almacenFalso({
      listarComandas: async (_empleado, puesto) => {
        vistos.push(puesto)
        return COMANDAS
      },
    })
    const barra = await manejar(
      await conSesion("/admin/pedidos/barra"),
      ENTORNO,
      AHORA,
      deps(COCINA, almacen),
    )
    const todo = await manejar(
      await conSesion("/admin/pedidos/todo"),
      ENTORNO,
      AHORA,
      deps(COCINA, almacen),
    )
    expect(vistos).toEqual(["barra", "todo"])
    expect(await barra.text()).toContain("Pedidos de barra")
    expect(await todo.text()).toContain("Todos los pedidos")
  })

  it("no debe servir un puesto que no existe", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/parrilla"),
      ENTORNO,
      AHORA,
      deps(COCINA),
    )
    expect(respuesta.status).toBe(404)
  })

  it("debe enlazar a las otras pantallas de puesto", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/pedidos/cocina"), ENTORNO, AHORA, deps(COCINA))
    ).text()
    expect(cuerpo).toContain('href="/admin/pedidos/barra"')
    expect(cuerpo).toContain('href="/admin/pedidos/todo"')
  })
})

describe("Puestos: la pantalla no ensena precios", () => {
  it("la cocina no debe mostrar las bebidas, y la barra si", async () => {
    const filtrar = async (
      _empleado: Empleado,
      puesto: PuestoDePantalla,
    ): Promise<readonly ComandaDePuesto[]> => {
      const destinos = destinosDelPuesto(puesto)
      return destinos === null
        ? COMANDAS
        : COMANDAS.filter((comanda) => destinos.includes(comanda.destino))
    }
    const almacen = almacenFalso({ listarComandas: filtrar })
    const cuerpoDe = async (puesto: string): Promise<string> =>
      await (
        await manejar(
          await conSesion(`/admin/pedidos/${puesto}`),
          ENTORNO,
          AHORA,
          deps(COCINA, almacen),
        )
      ).text()
    const cocina = await cuerpoDe("cocina")
    const barra = await cuerpoDe("barra")
    const todo = await cuerpoDe("todo")
    expect(cocina).toContain("Ceviche clásico")
    expect(cocina).not.toContain("Agua mineral")
    expect(barra).toContain("Agua mineral")
    expect(barra).not.toContain("Ceviche clásico")
    expect(todo).toContain("Ceviche clásico")
    expect(todo).toContain("Agua mineral")
  })

  it("no debe contener ningun importe en ningun puesto", async () => {
    for (const puesto of ["cocina", "barra", "todo"]) {
      const cuerpo = await (
        await manejar(
          await conSesion(`/admin/pedidos/${puesto}`),
          ENTORNO,
          AHORA,
          deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
        )
      ).text()
      expect(cuerpo).not.toContain("$")
      expect(cuerpo).not.toContain("17.800")
      expect(cuerpo).not.toContain("5.900")
    }
  })

  it("debe listar la comanda con su mesa, sus lineas, su destino y su estado", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/todo"),
        ENTORNO,
        AHORA,
        deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
      )
    ).text()
    expect(cuerpo).toContain("Mesa 4")
    expect(cuerpo).toContain("2× Ceviche clásico")
    expect(cuerpo).toContain("Frío")
    expect(cuerpo).toContain("Nueva")
  })

  it("debe hacer que la comanda nueva salte a la vista", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/cocina"),
        ENTORNO,
        AHORA,
        deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
      )
    ).text()
    expect(cuerpo).toContain("pedido-cocina-pendiente")
    expect(cuerpo).toContain("Comanda nueva")
  })

  it("debe refrescarse sola, declarado en la pagina", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/cocina"),
        ENTORNO,
        AHORA,
        deps(COCINA, almacenFalso({ listarComandas: async () => COMANDAS })),
      )
    ).text()
    expect(cuerpo).toContain('http-equiv="refresh" content="15"')
  })

  it("debe decir cuando no hay pedidos abiertos", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/cocina"),
        ENTORNO,
        AHORA,
        deps(COCINA, almacenFalso({ listarComandas: async () => [] })),
      )
    ).text()
    expect(cuerpo).toContain("No hay pedidos abiertos")
  })

  it("sin sesion no debe mostrar ninguna comanda, solo la entrada", async () => {
    const respuesta = await manejar(peticion("/admin/pedidos"), ENTORNO, AHORA, deps(null))
    const cuerpo = await respuesta.text()
    expect(respuesta.status).toBe(200)
    expect(cuerpo).toContain('action="/admin/entrar"')
    expect(cuerpo).not.toContain("Ceviche clásico")
    expect(cuerpo).not.toContain("Mesa 4")
  })
})

describe("Puestos: aceptar, marcar lista y anular", () => {
  it("debe aceptar y volver a la pantalla del mismo puesto", async () => {
    let visto: { readonly id: string; readonly destino: string } | null = null
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "aceptada", puesto: "barra" },
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
    expect(respuesta.headers.get("location")).toBe("/admin/pedidos/barra?cambiado=1")
  })

  it("debe anular una comanda", async () => {
    let destinoVisto: string | null = null
    await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "anulada", puesto: "cocina" },
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
        formulario: { destino: "cerrada", puesto: "cocina" },
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
        formulario: { destino: "aceptada", puesto: "cocina" },
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

describe("Puestos: el enlace del cuadro de mando", () => {
  it("debe enlazar a los pedidos desde el panel", async () => {
    const respuesta = await manejar(await conSesion("/admin"), ENTORNO, AHORA, deps(DUENO))
    expect(await respuesta.text()).toContain('href="/admin/pedidos"')
  })
})
