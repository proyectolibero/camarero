/**
 * La pantalla publica del comensal y su estado de emparejamiento.
 *
 * Se prueba el enrutador completo con el almacen de comensal inyectado: ninguna prueba toca
 * Postgres. Se demuestra que un codigo valido pinta la carta, que un codigo inventado no
 * resuelve nada, que la cookie de sesion es inalcanzable para el navegador y que la pantalla
 * funciona SIN JavaScript.
 */
import { describe, expect, it } from "vitest"
import {
  type AlmacenComensal,
  type CartaDelComensal,
  type LecturaComensal,
  localEnServicio,
} from "../src/comensal/datos.ts"
import { manejar } from "../src/enrutador.ts"
import { AHORA, comensalFalso, ENTORNO, peticion } from "./apoyo.ts"

function carta(parciales: Partial<CartaDelComensal> = {}): CartaDelComensal {
  return {
    local: "Barra Uno",
    mesa: "Mesa 4",
    estado: "sin_pedir",
    restanteSegundos: 90,
    subtotalAcumuladoClp: 0,
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
          {
            id: "p2",
            nombre: "Empanada de queso",
            descripcion: null,
            precioClp: 5000,
            fotoClave: "foto.png",
            puestoId: "pu-barra",
            puestoNombre: "Barra",
            autoAcepta: true,
          },
        ],
      },
    ],
    ...parciales,
  }
}

function ok(datos: CartaDelComensal, sesionId = "sesion-1"): LecturaComensal {
  return { tipo: "ok", sesionId, carta: datos }
}

describe("Comensal: la carta de la mesa", () => {
  it("debe pintar la carta del local y las fotos con un codigo valido", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta()) }),
    })
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Barra Uno")
    expect(cuerpo).toContain("Mesa 4")
    expect(cuerpo).toContain("Ceviche clásico")
    expect(cuerpo).toContain('src="/cartas/foto.png"')
    expect(cuerpo).toContain("Pedir emparejarse")
    expect(cuerpo).toContain('action="/t/ABCDEFGH/pareja"')
  })

  it("no debe mostrar un error tecnico con un codigo inventado", async () => {
    const respuesta = await manejar(peticion("/t/ZZZZZZZZ"), ENTORNO, AHORA, {
      comensal: comensalFalso(),
    })
    expect(respuesta.status).toBe(404)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Este código no corresponde a ninguna mesa")
    expect(cuerpo).not.toContain("no_encontrado")
  })

  it("no debe consultar el almacen si el codigo no tiene el formato correcto", async () => {
    let consultado = false
    const respuesta = await manejar(peticion("/t/malo"), ENTORNO, AHORA, {
      comensal: comensalFalso({
        abrir: async () => {
          consultado = true
          return ok(carta())
        },
      }),
    })
    expect(respuesta.status).toBe(404)
    expect(consultado).toBe(false)
  })

  it("debe pasar el codigo y la cookie de mesa al almacen", async () => {
    let visto: { codigo: string; sesionId: string | null } | null = null
    await manejar(peticion("/t/ABCDEFGH", { cookieMesa: "sesion-cookie" }), ENTORNO, AHORA, {
      comensal: comensalFalso({
        abrir: async (codigo, sesionId) => {
          visto = { codigo, sesionId }
          return ok(carta())
        },
      }),
    })
    expect(visto).toEqual({ codigo: "ABCDEFGH", sesionId: "sesion-cookie" })
  })

  it("no debe mostrar la carta con una sesión cerrada: el identificador deja de valer", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH", { cookieMesa: "sesion-cerrada" }),
      ENTORNO,
      AHORA,
      { comensal: comensalFalso({ abrir: async () => ({ tipo: "sesion_cerrada" }) }) },
    )
    expect(respuesta.status).toBe(410)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("La cuenta de esta mesa se cerró")
    expect(cuerpo).not.toContain("Ceviche clásico")
    // La cookie se borra: la mesa se reabre con una sesión nueva, no con la vieja.
    expect(respuesta.headers.get("set-cookie") ?? "").toContain("camarero_mesa=;")
    expect(respuesta.headers.get("set-cookie") ?? "").toContain("Max-Age=0")
  })
})

/**
 * El estado del local decide que se dibuja. La misma decision que toma la base (`localEnServicio`)
 * alimenta el almacen falso: si alguien cambia que estados abren mesa, esta prueba lo refleja, y
 * una prueba aparte fija esa decision estado a estado.
 */
function almacenDeEstadoLocal(estado: string): AlmacenComensal {
  const sirve = (): boolean => localEnServicio(estado)
  return comensalFalso({
    abrir: async () => (sirve() ? ok(carta()) : { tipo: "local_inactivo" }),
    pedir: async () => (sirve() ? ok(carta({ estado: "esperando" })) : { tipo: "local_inactivo" }),
  })
}

const MENSAJE_LOCAL_INACTIVO = "Este local todavía no está tomando pedidos"

describe("Comensal: solo un local active abre mesa", () => {
  it("debe servir el local activo y no servirlo cuando esta en borrador ni en pausa", () => {
    expect(localEnServicio("active")).toBe(true)
    expect(localEnServicio("draft")).toBe(false)
    expect(localEnServicio("paused")).toBe(false)
  })
})

describe("Comensal: la pantalla segun el estado del local", () => {
  const CASOS: ReadonlyArray<{ readonly estado: string; readonly abre: boolean }> = [
    { estado: "draft", abre: false },
    { estado: "paused", abre: false },
    { estado: "active", abre: true },
  ]

  for (const { estado, abre } of CASOS) {
    it(`debe abrir la carta o decirlo cuando el local esta en ${estado} (abre=${abre})`, async () => {
      const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
        comensal: almacenDeEstadoLocal(estado),
      })
      const cuerpo = await respuesta.text()
      if (abre) {
        expect(respuesta.status).toBe(200)
        expect(cuerpo).toContain("Ceviche clásico")
        expect(cuerpo).not.toContain(MENSAJE_LOCAL_INACTIVO)
      } else {
        // No es un 404: la mesa existe; el local es el que no esta sirviendo.
        expect(respuesta.status).toBe(503)
        expect(cuerpo).toContain(MENSAJE_LOCAL_INACTIVO)
        expect(cuerpo).toContain("Avísale al personal")
        // La carta de un local que no ha abierto NO se enseña.
        expect(cuerpo).not.toContain("Ceviche clásico")
        expect(cuerpo).not.toContain("Barra Uno")
      }
    })
  }

  it("debe decir que el local no ha abierto tambien al pedir emparejarse", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/pareja", { method: "POST" }),
      ENTORNO,
      AHORA,
      { comensal: almacenDeEstadoLocal("draft") },
    )
    expect(respuesta.status).toBe(503)
    expect(await respuesta.text()).toContain(MENSAJE_LOCAL_INACTIVO)
  })
})

describe("Comensal: la cookie de sesion de mesa", () => {
  it("debe dejar una cookie inalcanzable para el navegador y con caducidad", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta(), "sesion-9") }),
    })
    const cookie = respuesta.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("camarero_mesa=sesion-9")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
    expect(cookie).toContain("Max-Age=")
    expect(cookie).toContain("Path=/t")
  })
})

describe("Comensal: el estado del emparejamiento", () => {
  it("debe mostrar que esta esperando, con refresco automatico declarado", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta({ estado: "esperando" })) }),
    })
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Esperando que el local lo apruebe")
    expect(cuerpo).toContain('http-equiv="refresh"')
  })

  it("debe avisar de que ya puede pedir cuando esta aprobado", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta({ estado: "aprobado" })) }),
    })
    expect(await respuesta.text()).toContain("Ya puedes pedir")
  })

  it("debe decir que caduco y ofrecer volver a pedir", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta({ estado: "caducado" })) }),
    })
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("caducado")
    expect(cuerpo).toContain("Volver a pedir")
  })
})

describe("Comensal: pedir el emparejamiento", () => {
  it("debe redirigir a la carta con la cookie tras pedir", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/pareja", { method: "POST" }),
      ENTORNO,
      AHORA,
      {
        comensal: comensalFalso({
          pedir: async () => ok(carta({ estado: "esperando" }), "sesion-3"),
        }),
      },
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/t/ABCDEFGH")
    expect(respuesta.headers.get("set-cookie") ?? "").toContain("camarero_mesa=sesion-3")
  })

  it("debe responder 405 si se pide con GET", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH/pareja"), ENTORNO, AHORA, {
      comensal: comensalFalso(),
    })
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})

describe("Comensal: sin JavaScript y cabeceras", () => {
  it("no debe incluir ni un script en la pantalla", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta()) }),
    })
    const cuerpo = await respuesta.text()
    expect(cuerpo).not.toContain("<script")
    expect(cuerpo).not.toContain("javascript:")
  })

  it("no debe admitir unsafe-inline ni unsafe-eval en el CSP", async () => {
    const respuesta = await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, {
      comensal: comensalFalso({ abrir: async () => ok(carta()) }),
    })
    const csp = respuesta.headers.get("content-security-policy") ?? ""
    expect(csp).not.toContain("unsafe-inline")
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(respuesta.headers.get("x-content-type-options")).toBe("nosniff")
  })
})
