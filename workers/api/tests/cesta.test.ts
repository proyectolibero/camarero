/**
 * La cesta del comensal y el envio de la comanda.
 *
 * Se prueba el enrutador completo con el almacen inyectado: ninguna prueba toca Postgres. El
 * precio NUNCA sale de la cookie: la cesta solo lleva identificadores y cantidades (D-051) y
 * el total se resuelve contra la carta. La cerradura de verdad (que sin aprobacion no se crea
 * la comanda, y que el precio lo fija la base) se prueba contra Postgres en `packages/db`.
 */
import { describe, expect, it } from "vitest"
import type { LineaDeEnvio } from "../src/comensal/cesta.ts"
import type {
  AlmacenComensal,
  CartaDelComensal,
  LecturaComensal,
  PedidoDelComensal,
} from "../src/comensal/datos.ts"
import { manejar } from "../src/enrutador.ts"
import { AHORA, comensalFalso, ENTORNO, peticion } from "./apoyo.ts"

const P1 = "11111111-1111-1111-1111-111111111111"
const P2 = "22222222-2222-2222-2222-222222222222"

function carta(parciales: Partial<CartaDelComensal> = {}): CartaDelComensal {
  return {
    local: "Barra Uno",
    mesa: "Mesa 4",
    estado: "aprobado",
    restanteSegundos: null,
    categorias: [
      {
        id: "c1",
        nombre: "Entrantes",
        platos: [
          {
            id: P1,
            nombre: "Ceviche clásico",
            descripcion: null,
            precioClp: 8900,
            fotoClave: null,
            estacion: "frio",
          },
          {
            id: P2,
            nombre: "Empanada de queso",
            descripcion: null,
            precioClp: 5000,
            fotoClave: null,
            estacion: "caliente",
          },
        ],
      },
    ],
    ...parciales,
  }
}

function ok(datos: CartaDelComensal = carta()): LecturaComensal {
  return { tipo: "ok", sesionId: "sesion-1", carta: datos }
}

const PEDIDOS: readonly PedidoDelComensal[] = [
  {
    id: "o1",
    destino: "frio",
    estado: "pendiente",
    creadoHaceSegundos: 5,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2, totalClp: 17800 }],
    totalClp: 17800,
  },
]

describe("Cesta: anadir desde la carta", () => {
  it("debe poner un boton de anadir por plato con su accion por POST", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok() }),
    })
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/t/ABCDEFGH/cesta"')
    expect(cuerpo).toContain("Añadir")
    expect(cuerpo).toContain(`value="${P1}"`)
  })

  it("debe guardar en la cookie solo identificadores y cantidades, y volver a la carta", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta", {
        method: "POST",
        formulario: { plato: P1, cantidad: "2" },
      }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso({ abrir: async () => ok() }) },
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/t/ABCDEFGH")
    const cookie = respuesta.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("camarero_cesta=")
    expect(cookie).toContain(`${P1}:2`)
    // Ni un precio en la cookie: solo el identificador y la cantidad (D-051).
    expect(cookie).not.toContain("8900")
  })
})

describe("Cesta: la pantalla", () => {
  it("debe mostrar las lineas, el total de la carta y el aviso inequivoco", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta", { cookieCesta: `${P1}:2.${P2}:1` }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso({ abrir: async () => ok() }) },
    )
    const cuerpo = await respuesta.text()
    expect(respuesta.status).toBe(200)
    expect(cuerpo).toContain("Ceviche clásico")
    expect(cuerpo).toContain("×2")
    // 8900 × 2 + 5000 = 22800, con el precio de la carta.
    expect(cuerpo).toContain("22.800")
    expect(cuerpo).toContain("por partes")
    expect(cuerpo).toContain("la cocina y la barra")
    expect(cuerpo).toContain("no se deshace sola")
    expect(cuerpo).toContain('action="/t/ABCDEFGH/cesta/enviar"')
    expect(cuerpo).not.toContain("<script")
  })

  it("no debe cambiar el total aunque la cookie traiga basura manipulada", async () => {
    // Una cookie manipulada no puede inyectar un precio: lo que no es id:cantidad se descarta.
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta", { cookieCesta: `${P1}:1.9999999999:1.no-es-uuid:50` }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso({ abrir: async () => ok() }) },
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("8.900")
    expect(cuerpo).not.toContain("9999999999")
  })

  it("no debe ofrecer enviar cuando la mesa no esta aprobada", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta", { cookieCesta: `${P1}:1` }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso({ abrir: async () => ok(carta({ estado: "sin_pedir" })) }) },
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).not.toContain('action="/t/ABCDEFGH/cesta/enviar"')
    expect(cuerpo).toContain("Pedir emparejarse")
  })
})

describe("Cesta: subir, bajar y quitar", () => {
  it("debe subir la cantidad de una linea", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta/linea", {
        method: "POST",
        cookieCesta: `${P1}:1`,
        formulario: { plato: P1, accion: "subir" },
      }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso() },
    )
    expect(respuesta.headers.get("location")).toBe("/t/ABCDEFGH/cesta")
    expect(respuesta.headers.get("set-cookie") ?? "").toContain(`${P1}:2`)
  })

  it("debe quitar la linea al bajar de uno y al pulsar quitar", async () => {
    const bajar = await manejar(
      peticion("/t/ABCDEFGH/cesta/linea", {
        method: "POST",
        cookieCesta: `${P1}:1`,
        formulario: { plato: P1, accion: "bajar" },
      }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso() },
    )
    expect(bajar.headers.get("set-cookie") ?? "").not.toContain(`${P1}:`)

    const quitar = await manejar(
      peticion("/t/ABCDEFGH/cesta/linea", {
        method: "POST",
        cookieCesta: `${P1}:3`,
        formulario: { plato: P1, accion: "quitar" },
      }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso() },
    )
    expect(quitar.headers.get("set-cookie") ?? "").not.toContain(P1)
  })

  it("no debe admitir GET en la accion de la linea", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH/cesta/linea"), ENTORNO, AHORA, {
      comensal: comensalFalso(),
    })
    expect(respuesta.status).toBe(405)
  })
})

/** Almacen con idempotencia de mentira: recuerda las comandas por su clave. */
function almacenConEnvios(): {
  readonly almacen: AlmacenComensal
  readonly ordenes: Map<string, string>
  readonly lineasVistas: LineaDeEnvio[][]
} {
  const ordenes = new Map<string, string>()
  const lineasVistas: LineaDeEnvio[][] = []
  const almacen = comensalFalso({
    abrir: async () => ok(),
    pedidos: async () => ({ tipo: "ok", local: "Barra Uno", mesa: "Mesa 4", pedidos: PEDIDOS }),
    enviar: async (_codigo, _sesion, clave, lineas) => {
      if (lineas.length === 0) {
        return { tipo: "cesta_vacia" }
      }
      lineasVistas.push([...lineas])
      const existente = ordenes.get(clave)
      if (existente !== undefined) {
        return { tipo: "ok", pedidoId: existente }
      }
      const id = `pedido-${ordenes.size + 1}`
      ordenes.set(clave, id)
      return { tipo: "ok", pedidoId: id }
    },
  })
  return { almacen, ordenes, lineasVistas }
}

describe("Cesta: enviar la comanda", () => {
  it("debe enviar las lineas resueltas, vaciar la cesta y llevar al estado de los pedidos", async () => {
    const { almacen, lineasVistas } = almacenConEnvios()
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta/enviar", {
        method: "POST",
        cookieMesa: "sesion-1",
        cookieCesta: `${P1}:2`,
        formulario: { clave: "clave-1" },
      }),
      ENTORNO,
      AHORA,
      { comensal: almacen },
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/t/ABCDEFGH/pedidos")
    const cookies = respuesta.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.includes("camarero_cesta=;"))).toBe(true)
    // Las lineas que viajan a la base llevan solo identificador, cantidad y estacion de la
    // carta: jamas un precio.
    expect(Object.keys(lineasVistas[0]?.[0] ?? {}).sort()).toEqual([
      "cantidad",
      "estacion",
      "platoId",
    ])
  })

  it("no debe crear dos comandas cuando se envia dos veces con la misma clave", async () => {
    const { almacen, ordenes } = almacenConEnvios()
    const peticionDeEnvio = (): Request =>
      peticion("/t/ABCDEFGH/cesta/enviar", {
        method: "POST",
        cookieMesa: "sesion-1",
        cookieCesta: `${P1}:1`,
        formulario: { clave: "clave-doble" },
      })
    const primera = await manejar(peticionDeEnvio(), ENTORNO, AHORA, { comensal: almacen })
    const segunda = await manejar(peticionDeEnvio(), ENTORNO, AHORA, { comensal: almacen })
    expect(primera.status).toBe(303)
    expect(segunda.status).toBe(303)
    // Dos envios identicos: una sola comanda.
    expect(ordenes.size).toBe(1)
  })

  it("debe explicar que la mesa no esta aprobada cuando la base lo rechaza", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta/enviar", {
        method: "POST",
        cookieMesa: "sesion-1",
        cookieCesta: `${P1}:1`,
        formulario: { clave: "clave-x" },
      }),
      ENTORNO,
      AHORA,
      {
        comensal: comensalFalso({
          abrir: async () => ok(carta({ estado: "esperando" })),
          enviar: async () => ({ tipo: "sin_aprobar" }),
        }),
      },
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("todavía no ha aprobado tu mesa")
  })
})

describe("Cesta: el estado de los pedidos", () => {
  it("debe mostrar las comandas de la sesion con su estado", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/pedidos", { cookieMesa: "sesion-1" }),
      ENTORNO,
      AHORA,
      {
        comensal: comensalFalso({
          pedidos: async () => ({
            tipo: "ok",
            local: "Barra Uno",
            mesa: "Mesa 4",
            pedidos: PEDIDOS,
          }),
        }),
      },
    )
    const cuerpo = await respuesta.text()
    expect(respuesta.status).toBe(200)
    expect(cuerpo).toContain("Tus pedidos")
    expect(cuerpo).toContain("Enviada a cocina")
    expect(cuerpo).toContain("Ceviche clásico")
    expect(cuerpo).toContain('http-equiv="refresh"')
  })

  it("debe decir que no hay sesion de mesa si el dispositivo no la tiene", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH/pedidos"), ENTORNO, AHORA, {
      comensal: comensalFalso({ pedidos: async () => ({ tipo: "sin_sesion" }) }),
    })
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("Vuelve a escanear el QR")
  })
})
