/**
 * Las pantallas de puesto: una por puesto del local y la que muestra todo (`/admin/pedidos`).
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. La cerradura de
 * aislamiento (que un empleado de otro local no ve estas comandas) es de base y se prueba en
 * `packages/db`; aqui se demuestra que cada ruta sirve su puesto real, que la pantalla NO
 * ensena precios, que una comanda nueva salta a la vista, que acepta y anula por POST y que no
 * ofrece `cerrada`.
 */

import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import type { DependenciasParciales } from "../src/enrutador.ts"
import { manejar } from "../src/enrutador.ts"
import type { ComandaDePuesto, Puesto } from "../src/panel/datos.ts"
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

const PUESTOS: readonly Puesto[] = [
  {
    id: "pu-frio",
    nombre: "Frío",
    orden: 0,
    activo: true,
    autoAcepta: false,
    porDefecto: false,
  },
  { id: "pu-barra", nombre: "Barra", orden: 1, activo: true, autoAcepta: true, porDefecto: false },
]

const COMANDAS: readonly ComandaDePuesto[] = [
  {
    id: "o1",
    mesa: "Mesa 4",
    puestoId: "pu-frio",
    destino: "Frío",
    estado: "pendiente",
    creadaHaceSegundos: 5,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2 }],
  },
  {
    id: "o2",
    mesa: "Barra 2",
    puestoId: "pu-barra",
    destino: "Barra",
    estado: "aceptada",
    creadaHaceSegundos: 30,
    lineas: [{ nombre: "Agua mineral", cantidad: 1 }],
  },
]

let firmante: Firmante
beforeAll(async () => {
  firmante = await crearFirmante()
})

function deps(empleado: Empleado | null, almacen = conPuestos()): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    resolverEmpleado: async () => empleado,
    almacen,
  }
}

function conPuestos(parciales: Parameters<typeof almacenFalso>[0] = {}) {
  return almacenFalso({ listarPuestos: async () => PUESTOS, ...parciales })
}

async function conSesion(
  ruta: string,
  opciones: { readonly method?: string; readonly formulario?: Record<string, string> } = {},
): Promise<Request> {
  return peticion(ruta, { ...opciones, cookie: await firmante.tokenPara("u1") })
}

describe("Puestos: cada ruta sirve su pantalla", () => {
  it("sin puesto en la ruta debe servir todo junto", async () => {
    let puestoVisto: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/pedidos"),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        conPuestos({
          listarComandas: async (_empleado, puesto) => {
            puestoVisto = puesto
            return COMANDAS
          },
        }),
      ),
    )
    expect(puestoVisto).toBe("todo")
    expect(await respuesta.text()).toContain("Todos los pedidos")
  })

  it("debe servir un puesto del local y el todo por su ruta", async () => {
    const vistos: string[] = []
    const almacen = conPuestos({
      listarComandas: async (_empleado, puesto) => {
        vistos.push(puesto)
        return COMANDAS
      },
    })
    const frio = await manejar(
      await conSesion("/admin/pedidos/pu-frio"),
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
    expect(vistos).toEqual(["pu-frio", "todo"])
    expect(await frio.text()).toContain("Frío")
    expect(await todo.text()).toContain("Todos los pedidos")
  })

  it("no debe servir un puesto que no es del local", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/pu-parrilla"),
      ENTORNO,
      AHORA,
      deps(COCINA),
    )
    expect(respuesta.status).toBe(404)
  })

  it("debe enlazar a las otras pantallas de puesto", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/pedidos/pu-frio"), ENTORNO, AHORA, deps(COCINA))
    ).text()
    expect(cuerpo).toContain('href="/admin/pedidos/pu-barra"')
    expect(cuerpo).toContain('href="/admin/pedidos/todo"')
  })
})

describe("Puestos: la pantalla no ensena precios", () => {
  it("la pantalla de un puesto no debe mostrar las lineas de otro", async () => {
    const filtrar = async (
      _empleado: Empleado,
      puesto: string,
    ): Promise<readonly ComandaDePuesto[]> =>
      puesto === "todo" ? COMANDAS : COMANDAS.filter((comanda) => comanda.puestoId === puesto)
    const almacen = conPuestos({ listarComandas: filtrar })
    const cuerpoDe = async (puesto: string): Promise<string> =>
      await (
        await manejar(
          await conSesion(`/admin/pedidos/${puesto}`),
          ENTORNO,
          AHORA,
          deps(COCINA, almacen),
        )
      ).text()
    const frio = await cuerpoDe("pu-frio")
    const barra = await cuerpoDe("pu-barra")
    const todo = await cuerpoDe("todo")
    expect(frio).toContain("Ceviche clásico")
    expect(frio).not.toContain("Agua mineral")
    expect(barra).toContain("Agua mineral")
    expect(barra).not.toContain("Ceviche clásico")
    expect(todo).toContain("Ceviche clásico")
    expect(todo).toContain("Agua mineral")
  })

  it("no debe contener ningun importe en ningun puesto", async () => {
    for (const puesto of ["pu-frio", "pu-barra", "todo"]) {
      const cuerpo = await (
        await manejar(
          await conSesion(`/admin/pedidos/${puesto}`),
          ENTORNO,
          AHORA,
          deps(COCINA, conPuestos({ listarComandas: async () => COMANDAS })),
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
        deps(COCINA, conPuestos({ listarComandas: async () => COMANDAS })),
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
        await conSesion("/admin/pedidos/pu-frio"),
        ENTORNO,
        AHORA,
        deps(COCINA, conPuestos({ listarComandas: async () => COMANDAS })),
      )
    ).text()
    expect(cuerpo).toContain("pedido-cocina-pendiente")
    expect(cuerpo).toContain("Comanda nueva")
  })

  it("debe ofrecer servir en UN toque una comanda ya aceptada de la barra", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/pu-barra"),
        ENTORNO,
        AHORA,
        deps(
          COCINA,
          conPuestos({
            listarComandas: async () => COMANDAS.filter((c) => c.puestoId === "pu-barra"),
          }),
        ),
      )
    ).text()
    // La comanda o2 esta `aceptada`: la matriz (D-055) deja ir directa a `servida`.
    expect(cuerpo).toContain('value="servida"')
    expect(cuerpo).toContain("Marcar servida")
    expect(cuerpo).toContain('value="preparando"')
  })

  it("debe aceptar el salto aceptada -> servida por POST", async () => {
    let visto: { readonly id: string; readonly destino: string } | null = null
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o2/estado", {
        method: "POST",
        formulario: { destino: "servida", puesto: "pu-barra" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        conPuestos({
          cambiarEstadoComanda: async (_empleado, id, destino) => {
            visto = { id, destino }
            return { ok: true, valor: { estado: destino } }
          },
        }),
      ),
    )
    expect(visto).toEqual({ id: "o2", destino: "servida" })
    expect(respuesta.status).toBe(303)
  })

  it("debe refrescarse sola, declarado en la pagina", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/pu-frio"),
        ENTORNO,
        AHORA,
        deps(COCINA, conPuestos({ listarComandas: async () => COMANDAS })),
      )
    ).text()
    expect(cuerpo).toContain('http-equiv="refresh" content="15"')
  })

  it("debe decir cuando no hay pedidos abiertos", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/pu-frio"),
        ENTORNO,
        AHORA,
        deps(COCINA, conPuestos({ listarComandas: async () => [] })),
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
        formulario: { destino: "aceptada", puesto: "pu-barra" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        conPuestos({
          cambiarEstadoComanda: async (_empleado, id, destino) => {
            visto = { id, destino }
            return { ok: true, valor: { estado: destino } }
          },
        }),
      ),
    )
    expect(visto).toEqual({ id: "o1", destino: "aceptada" })
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/pedidos/pu-barra?cambiado=1")
  })

  it("debe anular una comanda", async () => {
    let destinoVisto: string | null = null
    await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "anulada", puesto: "todo" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        conPuestos({
          cambiarEstadoComanda: async (_empleado, _id, destino) => {
            destinoVisto = destino
            return { ok: true, valor: { estado: destino } }
          },
        }),
      ),
    )
    expect(destinoVisto).toBe("anulada")
  })

  it("no debe admitir un estado fuera de la pantalla, como cerrar la cuenta", async () => {
    let llamado = false
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o1/estado", {
        method: "POST",
        formulario: { destino: "cerrada", puesto: "todo" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        conPuestos({
          cambiarEstadoComanda: async () => {
            llamado = true
            return { ok: false, motivo: "transicion_invalida" }
          },
        }),
      ),
    )
    expect(llamado).toBe(false)
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("no se puede aplicar desde esta pantalla")
  })

  it("debe explicar una transicion no permitida", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/pedidos/o2/estado", {
        method: "POST",
        formulario: { destino: "aceptada", puesto: "todo" },
      }),
      ENTORNO,
      AHORA,
      deps(
        COCINA,
        conPuestos({
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
