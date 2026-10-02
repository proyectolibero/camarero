/**
 * La franja del gasto, siempre a la vista (D-056, TASK-F1-12).
 *
 * La informacion existia y el camino hasta ella no: al volver a la carta se perdia el acceso a
 * la cuenta. Esta prueba fija las dos mitades del contrato: la franja con el gasto y el enlace
 * esta en TODAS las pantallas del comensal donde ya hay mesa (la carta, la cesta y los pedidos,
 * que incluyen el estado del emparejamiento) y NO esta donde no hay mesa ni gasto.
 *
 * La prueba se ha comprobado capaz de fallar: sin la franja, el primer caso se pone en rojo
 * (evidencia en TASK-F1-12).
 */
import { describe, expect, it } from "vitest"
import type { CartaDelComensal, PedidoDelComensal } from "../src/comensal/datos.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import { AHORA, comensalFalso, ENTORNO, peticion } from "./apoyo.ts"

const PLATO = "04000000-0000-0000-0000-000000000001"

const GASTO_ETIQUETA = "Llevas gastado"
const VER_DESGLOSE = '<a class="boton-mini" href="/t/ABCDEFGH/pedidos">Ver el desglose</a>'
const VOLVER_A_LA_CARTA = '<a class="boton-mini" href="/t/ABCDEFGH">Volver a la carta</a>'
const SIN_PEDIDOS = "Todavía no has pedido nada"
const CLASE_FRANJA = "comensal-gasto"

function carta(parciales: Partial<CartaDelComensal> = {}): CartaDelComensal {
  return {
    local: "Barra Uno",
    mesa: "Mesa 4",
    estado: "aprobado",
    restanteSegundos: null,
    identidad: { modelo: "sobrio", acento: null, logoClave: null, portadaClave: null },
    avisos: [],
    subtotalAcumuladoClp: 17800,
    cuentaPedida: false,
    categorias: [
      {
        id: "c1",
        nombre: "Entrantes",
        platos: [
          {
            id: PLATO,
            nombre: "Ceviche clásico",
            descripcion: null,
            precioClp: 8900,
            fotoClave: null,
            puestoId: "pu-frio",
            puestoNombre: "Frío",
            autoAcepta: false,
          },
        ],
      },
    ],
    ...parciales,
  }
}

const PEDIDO: PedidoDelComensal = {
  id: "o1",
  destino: "Frío",
  estado: "pendiente",
  creadoHaceSegundos: 5,
  lineas: [{ nombre: "Ceviche clásico", cantidad: 2, totalClp: 17800 }],
  totalClp: 17800,
}

/** Almacen que abre la carta dada y sirve la pantalla de pedidos con una comanda. */
function almacenConGasto(datos: CartaDelComensal): DependenciasParciales {
  return {
    comensal: comensalFalso({
      abrir: async () => ({ tipo: "ok", sesionId: "sesion-1", carta: datos }),
      pedidos: async () => ({
        tipo: "ok",
        local: datos.local,
        mesa: datos.mesa,
        identidad: { modelo: "sobrio", acento: null, logoClave: null, portadaClave: null },
        pedidos: [PEDIDO],
        subtotalAcumuladoClp: 17800,
        cuentaPedida: false,
      }),
    }),
  }
}

async function cuerpoDe(ruta: string, deps: DependenciasParciales): Promise<string> {
  const respuesta = await manejar(
    peticion(ruta, ruta.includes("cesta") ? { cookieCesta: `${PLATO}:2` } : {}),
    ENTORNO,
    AHORA,
    deps,
  )
  return await respuesta.text()
}

describe("Comensal: la franja del gasto aparece en todas las pantallas con mesa", () => {
  it("debe mostrar el gasto y el desglose en la carta", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH", almacenConGasto(carta()))
    expect(cuerpo).toContain(CLASE_FRANJA)
    expect(cuerpo).toContain(GASTO_ETIQUETA)
    expect(cuerpo).toContain("17.800")
    expect(cuerpo).toContain(VER_DESGLOSE)
  })

  it("debe mostrar el gasto y el desglose en la cesta", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH/cesta", almacenConGasto(carta()))
    expect(cuerpo).toContain(CLASE_FRANJA)
    expect(cuerpo).toContain(GASTO_ETIQUETA)
    expect(cuerpo).toContain(VER_DESGLOSE)
  })

  it("debe mostrar el gasto y la vuelta a la carta en los pedidos", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH/pedidos", almacenConGasto(carta()))
    expect(cuerpo).toContain(CLASE_FRANJA)
    expect(cuerpo).toContain(GASTO_ETIQUETA)
    expect(cuerpo).toContain("17.800")
    expect(cuerpo).toContain(VOLVER_A_LA_CARTA)
  })

  it("debe decir que aun no hay nada pedido, sin un cero sin explicar", async () => {
    const cuerpo = await cuerpoDe(
      "/t/ABCDEFGH",
      almacenConGasto(carta({ subtotalAcumuladoClp: 0 })),
    )
    expect(cuerpo).toContain(CLASE_FRANJA)
    expect(cuerpo).toContain(SIN_PEDIDOS)
    expect(cuerpo).not.toContain(GASTO_ETIQUETA)
    // Un «$ 0» suelto pareceria una franja rota.
    expect(cuerpo).not.toContain("$ 0")
  })
})

describe("Comensal: la franja NO aparece donde no hay mesa ni gasto", () => {
  it("no debe aparecer con un codigo que no corresponde a ninguna mesa", async () => {
    const cuerpo = await cuerpoDe("/t/ZZZZZZZZ", { comensal: comensalFalso() })
    expect(cuerpo).toContain("Este código no corresponde a ninguna mesa")
    expect(cuerpo).not.toContain(CLASE_FRANJA)
    expect(cuerpo).not.toContain(SIN_PEDIDOS)
  })

  it("no debe aparecer cuando el local no esta abierto", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH", {
      comensal: comensalFalso({ abrir: async () => ({ tipo: "local_inactivo" }) }),
    })
    expect(cuerpo).toContain("Este local todavía no está tomando pedidos")
    expect(cuerpo).not.toContain(CLASE_FRANJA)
  })

  it("no debe aparecer cuando la mesa ya se cerro", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH", {
      comensal: comensalFalso({ abrir: async () => ({ tipo: "sesion_cerrada" }) }),
    })
    expect(cuerpo).toContain("La cuenta de esta mesa se cerró")
    expect(cuerpo).not.toContain(CLASE_FRANJA)
  })

  it("no debe aparecer cuando el dispositivo no tiene sesion de mesa", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH/pedidos", {
      comensal: comensalFalso({ pedidos: async () => ({ tipo: "sin_sesion" }) }),
    })
    expect(cuerpo).toContain("No encontramos tu mesa")
    expect(cuerpo).not.toContain(CLASE_FRANJA)
  })
})

describe("Comensal: la franja no trae JavaScript", () => {
  it("no debe incluir ni un script en la pantalla con la franja", async () => {
    const cuerpo = await cuerpoDe("/t/ABCDEFGH", almacenConGasto(carta()))
    expect(cuerpo).not.toContain("<script")
    expect(cuerpo).not.toContain("javascript:")
    expect(cuerpo).not.toContain("style=")
  })
})
