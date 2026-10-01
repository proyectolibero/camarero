/**
 * La sala: todas las mesas, sus comandas y sus estados (TASK-F1-08, D-053).
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. La cerradura de
 * aislamiento (que un empleado de otro local no ve ni aprueba nada) es de base y se prueba
 * contra Postgres en `packages/db`; aqui se comprueba que cada ruta sirve su pantalla, que la
 * sala no muestra importes, que los estados se distinguen por forma y texto (no solo color),
 * que se aprueba desde la sala y desde un puesto, y que sin sesion no se ve ninguna mesa.
 */
import type { EstadoDeComanda } from "@camarero/domain"
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { ComandaDePuesto, Mesa, ResumenDeMesa } from "../src/panel/datos.ts"
import { estadoDeMesa } from "../src/panel/estado-mesa.ts"
import { AHORA, almacenFalso, crearFirmante, ENTORNO, type Firmante, peticion } from "./apoyo.ts"

const DUENO: Empleado = {
  staffId: "s1",
  correo: "duena@camarero.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Restaurante de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const CAMARERO: Empleado = { ...DUENO, staffId: "s2", nombre: "Garzón", rol: "server" }

function mesa(parcial: Partial<Mesa> & { readonly id: string; readonly etiqueta: string }): Mesa {
  return {
    codigo: "ABCDEFGH",
    capacidad: 4,
    kind: "mesa",
    activa: true,
    zonaId: "z1",
    zonaNombre: "Sala",
    posFila: 0,
    posColumna: 0,
    ...parcial,
  }
}

const MESA_LIBRE = mesa({ id: "m1", etiqueta: "Sala 1", posColumna: 0 })
const MESA_ESPERANDO = mesa({ id: "m2", etiqueta: "Sala 2", posColumna: 1 })
const MESA_PENDIENTE = mesa({
  id: "m3",
  etiqueta: "Barra 1",
  zonaId: "z2",
  zonaNombre: "Barra",
  posColumna: 0,
})
const MESA_SERVIDA = mesa({
  id: "m4",
  etiqueta: "Barra 2",
  zonaId: "z2",
  zonaNombre: "Barra",
  posColumna: 1,
})

function resumenDe(
  unaMesa: Mesa,
  sesionActiva: boolean,
  solicitudId: string | null,
  comandasSinServir: number,
): ResumenDeMesa {
  return { mesa: unaMesa, sesionActiva, solicitudId, comandasSinServir }
}

/** Un local con las cuatro mesas en los cuatro estados posibles, en dos zonas. */
const RESUMENES: readonly ResumenDeMesa[] = [
  resumenDe(MESA_LIBRE, false, null, 0),
  resumenDe(MESA_ESPERANDO, false, "pr-1", 0),
  resumenDe(MESA_PENDIENTE, true, null, 2),
  resumenDe(MESA_SERVIDA, true, null, 0),
]

const COMANDAS_DE_MESA: readonly ComandaDePuesto[] = [
  {
    id: "o1",
    mesa: "Barra 1",
    puestoId: "pu-frio",
    destino: "Frío",
    estado: "pendiente",
    creadaHaceSegundos: 5,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2 }],
  },
  {
    id: "o2",
    mesa: "Barra 1",
    puestoId: "pu-barra",
    destino: "Barra",
    estado: "servida",
    creadaHaceSegundos: 600,
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

function almacenDeSala(
  resumenes: readonly ResumenDeMesa[] = RESUMENES,
  comandas: readonly ComandaDePuesto[] = COMANDAS_DE_MESA,
) {
  return almacenFalso({
    listarSala: async () => resumenes,
    listarComandasDeMesa: async () => comandas,
  })
}

// Las comprobaciones tienen que saber fallar: si no, son decorativas.
function contieneImporte(texto: string): boolean {
  return texto.includes("$")
}

function contieneScript(texto: string): boolean {
  return texto.includes("<script")
}

describe("Sala: el estado de una mesa, paso a paso", () => {
  it("debe ser libre sin sesion aprobada", () => {
    expect(estadoDeMesa(resumenDe(MESA_LIBRE, false, null, 0))).toBe("libre")
  })

  it("debe ser esperando aprobacion cuando hay una solicitud viva, aunque no haya sesion aprobada", () => {
    expect(estadoDeMesa(resumenDe(MESA_ESPERANDO, false, "pr", 0))).toBe("esperando_aprobacion")
  })

  it("debe ser con comandas pendientes cuando hay sesion aprobada y comandas sin servir", () => {
    expect(estadoDeMesa(resumenDe(MESA_PENDIENTE, true, null, 1))).toBe("comandas_pendientes")
  })

  it("debe ser todo servido cuando hay sesion aprobada y nada pendiente", () => {
    expect(estadoDeMesa(resumenDe(MESA_SERVIDA, true, null, 0))).toBe("todo_servido")
  })

  it("la aprobacion pesa mas que una comanda pendiente: no se puede servir lo que nadie aprobo", () => {
    expect(estadoDeMesa(resumenDe(MESA_PENDIENTE, true, "pr", 3))).toBe("esperando_aprobacion")
  })
})

describe("Sala: todas las mesas y sus estados", () => {
  it("debe mostrar todas las mesas del local, en sus dos zonas y sin filtrar por puesto", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenDeSala()),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("<h2>Sala</h2>")
    expect(cuerpo).toContain("<h2>Barra</h2>")
    for (const etiqueta of ["Sala 1", "Sala 2", "Barra 1", "Barra 2"]) {
      expect(cuerpo).toContain(etiqueta)
    }
  })

  it("debe pintar los cuatro estados con su clase", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    for (const estado of [
      "mapa-mesa-estado-libre",
      "mapa-mesa-estado-esperando_aprobacion",
      "mapa-mesa-estado-comandas_pendientes",
      "mapa-mesa-estado-todo_servido",
    ]) {
      expect(cuerpo).toContain(estado)
    }
  })

  it("debe distinguir los estados por forma y por texto, no solo por color", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    // Forma: cada estado lleva su glifo y su borde.
    expect(cuerpo).toContain(">?</text>")
    expect(cuerpo).toContain(">!</text>")
    expect(cuerpo).toContain("✓")
    // Texto: la leyenda y los distintivos dicen el estado en palabras.
    for (const etiqueta of [
      "Libre",
      "Esperando aprobación",
      "Con comandas pendientes",
      "Todo servido",
    ]) {
      expect(cuerpo).toContain(etiqueta)
    }
  })

  it("debe decir «Desactivada», no «Libre», para una mesa fuera de servicio", async () => {
    const fueraDeServicio = mesa({ id: "m9", etiqueta: "Terraza 9", activa: false })
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/sala"),
        ENTORNO,
        AHORA,
        deps(DUENO, almacenDeSala([resumenDe(fueraDeServicio, false, null, 0)])),
      )
    ).text()
    expect(cuerpo).toContain("sala-estado-desactivada")
    expect(cuerpo).toContain("Desactivada")
    expect(cuerpo).not.toContain("mapa-mesa-estado-libre")
  })

  it("no debe mostrar ningun importe: es una pantalla de servicio, no de caja", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(contieneImporte(cuerpo)).toBe(false)
    expect(cuerpo).not.toContain("17.800")
    expect(cuerpo).not.toContain("8.900")
  })

  it("la comprobacion de importes debe saber fallar", () => {
    expect(contieneImporte("<p>Total: $12.000</p>")).toBe(true)
    expect(contieneImporte("<p>Dos comandas sin servir</p>")).toBe(false)
  })

  it("debe dejar aprobar el emparejamiento desde la sala", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(cuerpo).toContain('action="/admin/parejas/pr-1/aprobar"')
    expect(cuerpo).toContain('name="volver" value="/admin/sala"')
    expect(cuerpo).toContain("esperando aprobación (1)")
  })

  it("debe refrescarse sola y no usar JavaScript", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(cuerpo).toContain('http-equiv="refresh" content="20"')
    expect(contieneScript(cuerpo)).toBe(false)
  })

  it("sin sesion no debe ver ninguna mesa, solo la entrada", async () => {
    for (const ruta of ["/admin/sala", "/admin/sala/m1"]) {
      const respuesta = await manejar(peticion(ruta), ENTORNO, AHORA, deps(null, almacenDeSala()))
      const cuerpo = await respuesta.text()
      expect(respuesta.status).toBe(200)
      expect(cuerpo).toContain('action="/admin/entrar"')
      expect(cuerpo).not.toContain("<svg")
      expect(cuerpo).not.toContain("Sala 1")
    }
  })

  it("un empleado de otro local no debe ver ninguna mesa", async () => {
    // La cerradura real es la RLS (packages/db): aqui la base no le devuelve filas.
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/sala"),
        ENTORNO,
        AHORA,
        deps(CAMARERO, almacenDeSala([])),
      )
    ).text()
    expect(cuerpo).not.toContain("<svg")
    expect(cuerpo).toContain("Todavía no hay mesas")
  })
})

describe("Sala: el detalle de una mesa y sus comandas", () => {
  it("debe mostrar la mesa con sus comandas, su puesto, su estado y sus lineas", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenDeSala()),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Barra 1")
    expect(cuerpo).toContain("Frío")
    expect(cuerpo).toContain("Nueva")
    expect(cuerpo).toContain("2× Ceviche clásico")
    expect(cuerpo).toContain("Agua mineral")
  })

  it("no debe mostrar ningun importe en el detalle", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala/m3"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(contieneImporte(cuerpo)).toBe(false)
    expect(cuerpo).not.toContain("17.800")
    expect(cuerpo).not.toContain("5.900")
  })

  it("debe ofrecer anular una comanda por POST", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala/m3"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(cuerpo).toContain('action="/admin/sala/m3/comandas/o1/anular"')
    expect(cuerpo).toContain('method="post"')
  })

  it("debe anular la comanda y volver al detalle de la mesa", async () => {
    let visto: { readonly id: string; readonly destino: EstadoDeComanda } | null = null
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3/comandas/o1/anular", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          listarSala: async () => RESUMENES,
          cambiarEstadoComanda: async (_empleado, id, destino) => {
            visto = { id, destino }
            return { ok: true, valor: { estado: destino } }
          },
        }),
      ),
    )
    expect(visto).toEqual({ id: "o1", destino: "anulada" })
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/sala/m3?anulada=1")
  })

  it("debe explicar una comanda que ya no se puede anular", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3/comandas/o9/anular", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          listarSala: async () => RESUMENES,
          listarComandasDeMesa: async () => COMANDAS_DE_MESA,
          cambiarEstadoComanda: async () => ({ ok: false, motivo: "transicion_invalida" }),
        }),
      ),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("ya no se puede anular")
  })

  it("no debe admitir GET en la accion de anular", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3/comandas/o1/anular"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenDeSala()),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })

  it("debe responder 404 si la mesa no existe o no es visible", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala/inexistente"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenDeSala()),
    )
    expect(respuesta.status).toBe(404)
  })
})

describe("Aprobacion en las pantallas de puesto", () => {
  const PENDIENTES = [{ id: "pr-1", mesa: "Sala 2", pedidaHaceSegundos: 8, restanteSegundos: 592 }]

  it("debe avisar en la pantalla de trabajo con el numero y un camino directo para aprobar", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos"),
        ENTORNO,
        AHORA,
        deps(CAMARERO, almacenFalso({ listarParejasPendientes: async () => PENDIENTES })),
      )
    ).text()
    expect(cuerpo).toContain("esperando aprobación (1)")
    expect(cuerpo).toContain('action="/admin/parejas/pr-1/aprobar"')
    // La pantalla sin puesto se sirve como `todo`; el retorno tiene que ser esa misma ruta.
    expect(cuerpo).toContain('name="volver" value="/admin/pedidos/todo"')
  })

  it("no debe avisar si no hay emparejamientos pendientes", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/pedidos/todo"),
        ENTORNO,
        AHORA,
        deps(CAMARERO, almacenFalso()),
      )
    ).text()
    expect(cuerpo).not.toContain("esperando aprobación")
  })

  it("debe volver al puesto REAL por el que se aprueba, no a una ruta inventada", async () => {
    // La aplicacion produce /admin/pedidos/<id-de-puesto> y /admin/sala/<id-de-mesa>. El
    // retorno tiene que conservarlos: si la lista blanca no los admitiera, aprobar expulsaria
    // al empleado de la pantalla en la que estaba (H1).
    for (const volver of ["/admin/pedidos/pu-frio", "/admin/sala/m3"]) {
      let visto: string | null = null
      const respuesta = await manejar(
        await conSesion("/admin/parejas/pr-1/aprobar", {
          method: "POST",
          formulario: { volver },
        }),
        ENTORNO,
        AHORA,
        deps(
          CAMARERO,
          almacenFalso({
            aprobarPareja: async (_empleado, solicitudId) => {
              visto = solicitudId
              return { ok: true, valor: undefined }
            },
          }),
        ),
      )
      expect(visto).toBe("pr-1")
      expect(respuesta.status).toBe(303)
      expect(respuesta.headers.get("location")).toBe(`${volver}?aprobada=1`)
    }
  })

  it("no debe admitir un destino de vuelta inventado: vuelve al panel de solicitudes", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/parejas/pr-1/aprobar", {
        method: "POST",
        formulario: { volver: "https://malicioso.test" },
      }),
      ENTORNO,
      AHORA,
      deps(CAMARERO, almacenFalso()),
    )
    expect(respuesta.headers.get("location")).toBe("/admin/parejas?aprobada=1")
  })

  it("debe enlazar a la sala desde el panel", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin"), ENTORNO, AHORA, deps(DUENO))
    ).text()
    expect(cuerpo).toContain('href="/admin/sala"')
  })
})

describe("Sala: cerrar la mesa (TASK-F1-10)", () => {
  it("debe ofrecer cerrar la mesa con un POST en la sala y en su detalle", async () => {
    const sala = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(sala).toContain('action="/admin/sala/m3/cerrar"')
    expect(sala).toContain('method="post"')
    const detalle = await (
      await manejar(await conSesion("/admin/sala/m3"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(detalle).toContain("Cerrar mesa")
  })

  it("no debe ofrecer cerrar una mesa libre", async () => {
    const cuerpo = await (
      await manejar(await conSesion("/admin/sala"), ENTORNO, AHORA, deps(DUENO, almacenDeSala()))
    ).text()
    expect(cuerpo).not.toContain("/admin/sala/m1/cerrar")
  })

  it("debe cerrar la mesa y volver a su detalle con la marca", async () => {
    let visto: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3/cerrar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          listarSala: async () => RESUMENES,
          cerrarSesion: async (_empleado, mesaId) => {
            visto = mesaId
            return { ok: true, valor: undefined }
          },
        }),
      ),
    )
    expect(visto).toBe("m3")
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/sala/m3?cerrada=1")
  })

  it("debe decir «Mesa cerrada.» cuando se vuelve con la marca", async () => {
    const cuerpo = await (
      await manejar(
        await conSesion("/admin/sala/m3?cerrada=1"),
        ENTORNO,
        AHORA,
        deps(DUENO, almacenDeSala()),
      )
    ).text()
    expect(cuerpo).toContain("Mesa cerrada.")
  })

  it("debe explicar una mesa que ya no tiene sesión abierta", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3/cerrar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          listarSala: async () => RESUMENES,
          cerrarSesion: async () => ({ ok: false, motivo: "no_existe" }),
        }),
      ),
    )
    expect(respuesta.status).toBe(404)
    expect(await respuesta.text()).toContain("ya no tiene una sesión abierta")
  })

  it("no debe admitir GET en la accion de cerrar", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/sala/m3/cerrar"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenDeSala()),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})
