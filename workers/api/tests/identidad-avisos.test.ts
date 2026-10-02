/**
 * La identidad del local como dato y los avisos del comensal (TASK-F4-01, TASK-F1-13).
 *
 * Se prueba el enrutador completo con el almacen inyectado: ninguna prueba sale a la red ni
 * toca Postgres. Cada prueba demuestra el caso que debe funcionar y, donde aplica, el que debe
 * negarse, para que una cerradura no pase por vacia.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import type { AlmacenComensal, CartaDelComensal, IdentidadDelLocal } from "../src/comensal/datos.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { AlmacenPanel, AvisoDeMesa } from "../src/panel/datos.ts"
import {
  AHORA,
  comensalFalso,
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

const IDENTIDAD_NOCTURNA: IdentidadDelLocal = {
  modelo: "nocturno",
  acento: "#b98cf0",
  logoClave: "logo.png",
  portadaClave: "portada.png",
}

function carta(parciales: Partial<CartaDelComensal> = {}): CartaDelComensal {
  return {
    local: "Barra Uno",
    mesa: "Mesa 4",
    estado: "aprobado",
    restanteSegundos: null,
    identidad: IDENTIDAD_NOCTURNA,
    avisos: [],
    subtotalAcumuladoClp: 17800,
    cuentaPedida: false,
    categorias: [
      {
        id: "c1",
        nombre: "Entrantes",
        platos: [
          {
            id: "p1",
            nombre: "Ceviche clásico",
            descripcion: "Corvina y limón",
            precioClp: 8900,
            fotoClave: null,
            puestoId: "pu-frio",
            puestoNombre: "Frío",
            autoAcepta: false,
          },
        ],
      },
      {
        id: "c2",
        nombre: "Principales",
        platos: [
          {
            id: "p4",
            nombre: "Lomo a lo pobre",
            descripcion: null,
            precioClp: 15900,
            fotoClave: null,
            puestoId: "pu-parrilla",
            puestoNombre: "Parrilla",
            autoAcepta: false,
          },
        ],
      },
    ],
    ...parciales,
  }
}

function conCarta(datos: CartaDelComensal): DependenciasParciales {
  return {
    comensal: comensalFalso({ abrir: async () => ({ tipo: "ok", sesionId: "s1", carta: datos }) }),
  }
}

describe("La carta del comensal como puerta de entrada", () => {
  it("debe llevar el logo, la portada y las píldoras de categoría", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, conCarta(carta()))
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('src="/cartas/logo.png"')
    expect(cuerpo).toContain('src="/cartas/portada.png"')
    expect(cuerpo).toContain('class="comensal-pildora"')
    expect(cuerpo).toContain('href="#cat-c1"')
    expect(cuerpo).toContain('href="#cat-c2"')
    expect(cuerpo).toContain('id="cat-c1"')
  })

  it("debe añadir cada plato con un botón grande, no un enlace pequeño", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, conCarta(carta()))
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("comensal-agregar-boton")
    expect(cuerpo).toContain("Añadir")
    expect(cuerpo).toContain('action="/t/ABCDEFGH/cesta"')
  })

  it("debe enlazar la hoja de tema propia del local", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, conCarta(carta()))
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('href="/t/ABCDEFGH/tema.css"')
  })

  it("no debe contener ni una etiqueta script", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, conCarta(carta()))
    expect((await respuesta.text()).toLowerCase()).not.toContain("<script")
  })
})

describe("El tema del local se sirve por su cuenta", () => {
  it("debe devolver el CSS del modelo del local, con su acento", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/tema.css"),
      ENTORNO,
      AHORA,
      conCarta(carta()),
    )
    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get("content-type")).toContain("text/css")
    const css = await respuesta.text()
    expect(css).toContain("--crudo-acento: #b98cf0")
    // Nocturno es oscuro por definicion: el esquema lo dice.
    expect(css).toContain("color-scheme: dark")
  })

  it("debe servir el modelo por defecto si el código no existe", async () => {
    const respuesta = await manejar(peticion("/t/ZZZZZZZZ/tema.css"), ENTORNO, AHORA, {
      comensal: comensalFalso(),
    })
    const css = await respuesta.text()
    expect(css).toContain("--crudo-acento:")
  })
})

describe("El comensal pide un aviso y ve que lo ha pedido", () => {
  function almacenAvisos(llamadas: string[]): AlmacenComensal {
    return comensalFalso({
      abrir: async () => ({ tipo: "ok", sesionId: "s1", carta: carta() }),
      avisar: async (_codigo, _sesion, tipo) => {
        llamadas.push(tipo)
        return { tipo: "ok" }
      },
    })
  }

  it("debe mandar la llamada al empleado y volver a la carta", async () => {
    const llamadas: string[] = []
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/avisar", {
        method: "POST",
        formulario: { tipo: "llamar_empleado" },
      }),
      ENTORNO,
      AHORA,
      { comensal: almacenAvisos(llamadas) },
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/t/ABCDEFGH")
    expect(llamadas).toEqual(["llamar_empleado"])
  })

  it("debe mandar el aviso de limpieza", async () => {
    const llamadas: string[] = []
    await manejar(
      peticion("/t/ABCDEFGH/avisar", {
        method: "POST",
        formulario: { tipo: "necesita_limpieza" },
      }),
      ENTORNO,
      AHORA,
      { comensal: almacenAvisos(llamadas) },
    )
    expect(llamadas).toEqual(["necesita_limpieza"])
  })

  it("no debe aceptar un tipo de aviso inventado", async () => {
    const llamadas: string[] = []
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/avisar", { method: "POST", formulario: { tipo: "traeme_cuenta" } }),
      ENTORNO,
      AHORA,
      { comensal: almacenAvisos(llamadas) },
    )
    expect(respuesta.status).toBe(404)
    expect(llamadas).toEqual([])
  })

  it("debe exigir POST para avisar", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH/avisar"), ENTORNO, AHORA, {
      comensal: comensalAvisosVacio(),
    })
    expect(respuesta.status).toBe(405)
  })

  function comensalAvisosVacio(): AlmacenComensal {
    return comensalFalso()
  }

  it("debe mostrar que ya lo ha pedido en lugar del botón", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH"),
      ENTORNO,
      AHORA,
      conCarta(carta({ avisos: [{ tipo: "llamar_empleado", pedidoHaceSegundos: 12 }] })),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Has llamado a un empleado")
    // El boton de la llamada ya no se ofrece; el de limpieza si (no se ha pedido).
    expect(cuerpo).not.toContain(">Llamar a un empleado<")
    expect(cuerpo).toContain("La mesa necesita limpieza")
  })
})

// ---------------------------------------------------------------------------
// El panel: identidad y avisos
// ---------------------------------------------------------------------------

const DUENO: Empleado = {
  staffId: "s1",
  correo: "dueno@prueba.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Organización de prueba" },
  local: { id: "l1", nombre: "Barra Uno", logoClave: "logo.png" },
}

const LOCAL = {
  id: "l1",
  orgId: "o1",
  nombre: "Barra Uno",
  slug: "barra-uno",
  timezone: "America/Santiago",
  currency: "CLP",
  status: "active",
  serviceMode: "dine_in" as const,
  modelo: "verde",
  acento: "#1d6b3a",
  logoClave: "logo.png",
  portadaClave: "portada.png",
}

function deps(almacen: AlmacenPanel, empleado: Empleado | null): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    autenticar: async () => null,
    resolverEmpleado: async () => empleado,
    almacen,
  }
}

describe("La identidad del local se edita desde el panel", () => {
  it("debe mostrar el modelo, el acento, el logo y la portada del local", async () => {
    const almacen = crearAlmacen({ leerLocal: async () => LOCAL })
    const respuesta = await manejar(
      peticion("/admin/local", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('name="modelo"')
    expect(cuerpo).toContain('value="#1d6b3a"')
    expect(cuerpo).toContain('value="logo.png"')
    expect(cuerpo).toContain('value="portada.png"')
  })

  it("debe guardar el modelo elegido y el acento", async () => {
    const cambios: unknown[] = []
    const almacen = crearAlmacen({
      leerLocal: async () => LOCAL,
      actualizarLocal: async (_empleado, guardados) => {
        cambios.push(guardados)
        return { ok: true, valor: undefined }
      },
    })
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: {
          nombre: "Barra Uno",
          zona_horaria: "America/Santiago",
          estado: "active",
          modo_servicio: "dine_in",
          modelo: "nocturno",
          acento: "#B98CF0",
          logo: "logo.png",
          portada: "portada.png",
        },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(cambios[0]).toMatchObject({
      modelo: "nocturno",
      acento: "#b98cf0",
      logoClave: "logo.png",
      portadaClave: "portada.png",
    })
  })

  it("no debe aceptar un modelo inventado", async () => {
    const cambios: unknown[] = []
    const almacen = crearAlmacen({
      leerLocal: async () => LOCAL,
      actualizarLocal: async (_empleado, guardados) => {
        cambios.push(guardados)
        return { ok: true, valor: undefined }
      },
    })
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: {
          nombre: "Barra Uno",
          zona_horaria: "America/Santiago",
          estado: "active",
          modo_servicio: "dine_in",
          modelo: "chillon",
        },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(cambios).toHaveLength(0)
  })

  it("no debe aceptar un acento que no es hex", async () => {
    const cambios: unknown[] = []
    const almacen = crearAlmacen({
      leerLocal: async () => LOCAL,
      actualizarLocal: async (_empleado, guardados) => {
        cambios.push(guardados)
        return { ok: true, valor: undefined }
      },
    })
    const respuesta = await manejar(
      peticion("/admin/local", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
        formulario: {
          nombre: "Barra Uno",
          zona_horaria: "America/Santiago",
          estado: "active",
          modo_servicio: "dine_in",
          modelo: "sobrio",
          acento: "rojo",
        },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(cambios).toHaveLength(0)
  })

  it("debe servir la hoja de estilos del panel con el acento del local", async () => {
    const almacen = crearAlmacen({ leerLocal: async () => LOCAL })
    const respuesta = await manejar(
      peticion("/panel/estilos.css", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const css = await respuesta.text()
    expect(css).toContain("--crudo-acento: #1d6b3a")
  })

  it("debe llevar el logo del local en la cabecera del panel", async () => {
    const almacen = crearAlmacen({
      leerLocal: async () => LOCAL,
      contarParejasPendientes: async () => 0,
    })
    const respuesta = await manejar(
      peticion("/admin", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(await respuesta.text()).toContain('src="/cartas/logo.png"')
  })
})

const AVISOS: readonly AvisoDeMesa[] = [
  { id: "a1", mesa: "Mesa 4", tipo: "llamar_empleado", pedidoHaceSegundos: 15 },
  { id: "a2", mesa: "Barra 2", tipo: "necesita_limpieza", pedidoHaceSegundos: 90 },
]

describe("El personal ve los avisos y los atiende", () => {
  it("debe listar los avisos con su mesa y su antigüedad", async () => {
    const almacen = crearAlmacen({ listarAvisos: async () => AVISOS })
    const respuesta = await manejar(
      peticion("/admin/avisos", { cookie: await firmante.tokenPara("u1") }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Llama a un empleado")
    expect(cuerpo).toContain("Mesa 4")
    expect(cuerpo).toContain("La mesa necesita limpieza")
    expect(cuerpo).toContain('action="/admin/avisos/a1/atender"')
  })

  it("debe marcar un aviso como atendido y volver con aviso de éxito", async () => {
    const atendidos: string[] = []
    const almacen = crearAlmacen({
      listarAvisos: async () => AVISOS,
      atenderAviso: async (_empleado, id) => {
        atendidos.push(id)
        return { ok: true }
      },
    })
    const respuesta = await manejar(
      peticion("/admin/avisos/a1/atender", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/avisos?atendido=1")
    expect(atendidos).toEqual(["a1"])
  })

  it("no debe atender sin sesión", async () => {
    const atendidos: string[] = []
    const almacen = crearAlmacen({
      atenderAviso: async (_empleado, id) => {
        atendidos.push(id)
        return { ok: true }
      },
    })
    const respuesta = await manejar(
      peticion("/admin/avisos/a1/atender", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, null),
    )
    expect(respuesta.status).toBe(401)
    expect(atendidos).toEqual([])
  })

  it("debe explicar el fallo cuando el aviso ya no está", async () => {
    const almacen = crearAlmacen({
      listarAvisos: async () => [],
      atenderAviso: async () => ({ ok: false, motivo: "no_existe" }),
    })
    const respuesta = await manejar(
      peticion("/admin/avisos/a9/atender", {
        method: "POST",
        cookie: await firmante.tokenPara("u1"),
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("ya no está pendiente")
  })
})
