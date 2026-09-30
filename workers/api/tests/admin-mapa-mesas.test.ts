/**
 * El mapa visual de mesas y el movimiento con botones grandes (TASK-F1-04).
 *
 * Se prueba el enrutador completo con la sesion y el almacen inyectados. La cerradura de
 * verdad (RLS y la restriccion de celda unica) se prueba contra Postgres en `packages/db`;
 * aqui se comprueba que la pantalla decide bien y que el HTML no gana ni una etiqueta script.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { AlmacenPanel, Mesa, Zona } from "../src/panel/datos.ts"
import type { Direccion } from "../src/panel/mapa.ts"
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

const ZONA_TERRAZA: Zona = { id: "z1", nombre: "Terraza", kind: "terraza", mesas: 2 }

function mesa(parcial: Partial<Mesa>): Mesa {
  return {
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
    ...parcial,
  }
}

const MESA_ACTIVA = mesa({})
const MESA_INACTIVA = mesa({
  id: "m2",
  codigo: "JKLMNPQR",
  etiqueta: "Terraza 5",
  activa: false,
  posFila: 0,
  posColumna: 1,
})

type EspiaMapa = {
  readonly almacen: AlmacenPanel
  readonly movimientos: ReadonlyArray<{ readonly mesaId: string; readonly direccion: Direccion }>
  readonly acomodos: () => number
}

function espiaMapa(
  mesas: readonly Mesa[],
  opciones: { readonly moverMesa?: AlmacenPanel["moverMesa"] } = {},
): EspiaMapa {
  const movimientos: Array<{ mesaId: string; direccion: Direccion }> = []
  let acomodos = 0
  const almacen = almacenFalso({
    listarMesas: async () => mesas,
    listarZonas: async () => [ZONA_TERRAZA],
    acomodarMesasSinPosicion: async () => {
      acomodos += 1
    },
    moverMesa:
      opciones.moverMesa ??
      (async (_empleado, mesaId, direccion) => {
        movimientos.push({ mesaId, direccion })
        return { ok: true }
      }),
  })
  return { almacen, movimientos, acomodos: () => acomodos }
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

function contieneScript(texto: string): boolean {
  return texto.includes("<script")
}

describe("Mapa: dibujo en el servidor", () => {
  it("debe dibujar un SVG por zona con su titulo y su mesa", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA, MESA_INACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('class="mapa-svg"')
    expect(cuerpo).toContain('role="img"')
    expect(cuerpo).toContain("Mapa de Terraza")
    expect(cuerpo).toContain("Terraza 4")
    expect(cuerpo).toContain("Terraza 5")
  })

  it("debe distinguir de un vistazo una mesa desactivada", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA, MESA_INACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("mapa-mesa-inactiva")
    expect(cuerpo).toContain("mapa-mesa-activa")
  })

  it("debe acomodar una mesa sin posicion al abrir el mapa", async () => {
    const nueva = mesa({ id: "m3", codigo: "STUVWXYZ", posFila: null, posColumna: null })
    const { almacen, acomodos } = espiaMapa([MESA_ACTIVA, nueva])
    await manejar(await conSesion("/admin/mesas"), ENTORNO, AHORA, deps(almacen, DUENO))
    expect(acomodos()).toBeGreaterThan(0)
  })
})

describe("Mapa: sin JavaScript", () => {
  it("debe saber fallar cuando el HTML lleva un script", () => {
    expect(contieneScript("<p>hola</p>")).toBe(false)
    expect(contieneScript("<p>hola</p><script>alert(1)</script>")).toBe(true)
  })

  it("no debe haber ni una etiqueta script en el mapa de mesas", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA, MESA_INACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("<svg")
    expect(contieneScript(cuerpo)).toBe(false)
  })
})

describe("Mover: botones y direcciones", () => {
  it("debe ofrecer botones grandes por POST, nunca enlaces", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/admin/mesas/m1/mover"')
    expect(cuerpo).toContain('method="post"')
    expect(cuerpo).toContain('class="mover-boton')
    expect(cuerpo).toContain('name="direccion"')
  })

  for (const direccion of ["arriba", "abajo", "izquierda", "derecha"] as const) {
    it(`debe mover hacia ${direccion} y redirigir`, async () => {
      const { almacen, movimientos } = espiaMapa([MESA_ACTIVA])
      const respuesta = await manejar(
        await conSesion("/admin/mesas/m1/mover", {
          method: "POST",
          formulario: { direccion },
        }),
        ENTORNO,
        AHORA,
        deps(almacen, DUENO),
      )
      expect(respuesta.status).toBe(303)
      expect(respuesta.headers.get("location")).toBe("/admin/mesas?movida=1")
      expect(movimientos).toEqual([{ mesaId: "m1", direccion }])
    })
  }
})

describe("Mover: fallos explicados en pantalla", () => {
  it("debe explicar el limite de la cuadricula con un 400", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA], {
      moverMesa: async () => ({ ok: false, motivo: "fuera_de_cuadricula" }),
    })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/mover", {
        method: "POST",
        formulario: { direccion: "arriba" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("borde")
  })

  it("debe explicar la celda ocupada con un 409", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA], {
      moverMesa: async () => ({ ok: false, motivo: "ocupada" }),
    })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/mover", {
        method: "POST",
        formulario: { direccion: "derecha" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("ocupada")
  })

  it("debe responder 404 si la mesa ya no existe", async () => {
    const { almacen } = espiaMapa([], {
      moverMesa: async () => ({ ok: false, motivo: "no_existe" }),
    })
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m9/mover", {
        method: "POST",
        formulario: { direccion: "arriba" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(404)
  })

  it("no debe aceptar una direccion inventada", async () => {
    const { almacen, movimientos } = espiaMapa([MESA_ACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/mover", {
        method: "POST",
        formulario: { direccion: "diagonal" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("dirección no es válida")
    expect(movimientos).toHaveLength(0)
  })

  it("no debe admitir GET en mover", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/mover"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})

describe("Mover: acceso y permiso", () => {
  it("debe llevar a la entrada sin sesion", async () => {
    const { almacen, movimientos } = espiaMapa([MESA_ACTIVA])
    const respuesta = await manejar(
      peticion("/admin/mesas/m1/mover", { method: "POST", formulario: { direccion: "arriba" } }),
      ENTORNO,
      AHORA,
      deps(almacen, null),
    )
    expect(respuesta.status).toBe(401)
    expect(await respuesta.text()).toContain('action="/admin/entrar"')
    expect(movimientos).toHaveLength(0)
  })

  it("no debe dejar mover al camarero", async () => {
    const { almacen, movimientos } = espiaMapa([MESA_ACTIVA])
    const respuesta = await manejar(
      await conSesion("/admin/mesas/m1/mover", {
        method: "POST",
        formulario: { direccion: "arriba" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
    expect(await respuesta.text()).toContain("No tienes permiso")
    expect(movimientos).toHaveLength(0)
  })

  it("sin sesion no debe dibujar el mapa", async () => {
    const { almacen } = espiaMapa([MESA_ACTIVA])
    const respuesta = await manejar(peticion("/admin/mesas"), ENTORNO, AHORA, deps(almacen, null))
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/admin/entrar"')
    expect(cuerpo).not.toContain("<svg")
  })
})
