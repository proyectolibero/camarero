/**
 * La cuenta en las rutas del borde (TASK-F3-01).
 *
 * La cerradura de verdad (que la base cierra la via de pedir platos con la cuenta pedida, que
 * el importe sale de la base y que la RLS aisla) se prueba contra Postgres en `packages/db`.
 * Aqui se comprueba que las PANTALLAS dicen la verdad y que la ruta del cobro NO acepta un
 * importe del cliente: se le manda un importe falso y se demuestra que no llega al almacen.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import type { CartaDelComensal, PedidoDelComensal } from "../src/comensal/datos.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { CuentaDeMesa, DatosDeCobro, ResumenDeMesa } from "../src/panel/datos.ts"
import {
  AHORA,
  almacenFalso,
  comensalFalso,
  crearFirmante,
  ENTORNO,
  type Firmante,
  peticion,
} from "./apoyo.ts"

const DUENO: Empleado = {
  staffId: "s1",
  correo: "duena@camarero.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Restaurante de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const COCINA: Empleado = { ...DUENO, staffId: "s3", nombre: "Cocina", rol: "kitchen" }

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

// ---------------------------------------------------------------------------
// El comensal
// ---------------------------------------------------------------------------

const P1 = "11111111-1111-1111-1111-111111111111"

const PEDIDO: PedidoDelComensal = {
  id: "o1",
  destino: "Parrilla",
  estado: "servida",
  creadoHaceSegundos: 60,
  lineas: [{ nombre: "Lomo a lo pobre", cantidad: 1, totalClp: 15900 }],
  totalClp: 15900,
}

function carta(cuentaPedida: boolean): CartaDelComensal {
  return {
    local: "Barra Uno",
    mesa: "Mesa 4",
    estado: "aprobado",
    restanteSegundos: null,
    identidad: { modelo: "sobrio", acento: null, logoClave: null, portadaClave: null },
    avisos: [],
    subtotalAcumuladoClp: 15900,
    cuentaPedida,
    categorias: [
      {
        id: "c1",
        nombre: "Principales",
        platos: [
          {
            id: P1,
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
  }
}

function comensalConCuenta(cuentaPedida: boolean, llamadas: { pedir?: number } = {}) {
  return comensalFalso({
    abrir: async () => ({ tipo: "ok", sesionId: "sesion-1", carta: carta(cuentaPedida) }),
    pedidos: async () => ({
      tipo: "ok",
      local: "Barra Uno",
      mesa: "Mesa 4",
      identidad: { modelo: "sobrio", acento: null, logoClave: null, portadaClave: null },
      pedidos: [PEDIDO],
      subtotalAcumuladoClp: 15900,
      cuentaPedida,
    }),
    pedirCuenta: async () => {
      llamadas.pedir = (llamadas.pedir ?? 0) + 1
      return { tipo: "ok" }
    },
  })
}

describe("Comensal: pedir la cuenta", () => {
  it("debe pedirla por POST y volver a los pedidos con la confirmacion", async () => {
    const llamadas: { pedir?: number } = {}
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cuenta", { method: "POST", cookieMesa: "sesion-1" }),
      ENTORNO,
      AHORA,
      { comensal: comensalConCuenta(false, llamadas) },
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/t/ABCDEFGH/pedidos?cuenta=1")
    expect(llamadas.pedir).toBe(1)
  })

  it("NO debe aceptar un GET: pedir la cuenta es una mutacion", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cuenta", { method: "GET", cookieMesa: "sesion-1" }),
      ENTORNO,
      AHORA,
      { comensal: comensalConCuenta(false) },
    )
    expect(respuesta.status).toBe(405)
  })

  it("debe ofrecer el boton antes de pedirla y quitarlo despues", async () => {
    const antes = await manejar(
      peticion("/t/ABCDEFGH", { cookieMesa: "sesion-1" }),
      ENTORNO,
      AHORA,
      { comensal: comensalConCuenta(false) },
    )
    const cuerpoAntes = await antes.text()
    expect(cuerpoAntes).toContain("Pedir la cuenta")
    expect(cuerpoAntes).toContain("Añadir")

    const despues = await manejar(
      peticion("/t/ABCDEFGH", { cookieMesa: "sesion-1" }),
      ENTORNO,
      AHORA,
      { comensal: comensalConCuenta(true) },
    )
    const cuerpoDespues = await despues.text()
    expect(cuerpoDespues).toContain("Has pedido la cuenta")
    expect(cuerpoDespues).not.toContain("Pedir la cuenta")
    // Sin cuenta pedida la carta ofrece añadir; con ella, no.
    expect(cuerpoDespues).not.toContain(">Añadir</button>")
    // La franja del gasto (D-056) sigue visible: no se le quita.
    expect(cuerpoDespues).toContain("Llevas gastado")
  })

  it("NO debe ofrecer enviar desde la cesta con la cuenta pedida", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta", { cookieMesa: "sesion-1", cookieCesta: `${P1}:1` }),
      ENTORNO,
      AHORA,
      { comensal: comensalConCuenta(true) },
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Has pedido la cuenta")
    expect(cuerpo).not.toContain("Enviar la comanda")
  })

  it("debe rechazar el envio directo cuando la cuenta ya esta pedida", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cesta/enviar", {
        method: "POST",
        cookieMesa: "sesion-1",
        cookieCesta: `${P1}:1`,
        formulario: { clave: "clave-1" },
      }),
      ENTORNO,
      AHORA,
      {
        comensal: comensalFalso({
          abrir: async () => ({ tipo: "ok", sesionId: "sesion-1", carta: carta(true) }),
          enviar: async () => ({ tipo: "cuenta_pedida" }),
        }),
      },
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("Ya has pedido la cuenta")
  })

  it("no debe pedir la cuenta sin sesion de mesa", async () => {
    const respuesta = await manejar(
      peticion("/t/ABCDEFGH/cuenta", { method: "POST" }),
      ENTORNO,
      AHORA,
      {
        comensal: comensalFalso({ pedirCuenta: async () => ({ tipo: "sin_sesion" }) }),
      },
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("No encontramos tu mesa")
  })
})

// ---------------------------------------------------------------------------
// El panel
// ---------------------------------------------------------------------------

function cuenta(parcial: Partial<CuentaDeMesa> & { readonly id: string }): CuentaDeMesa {
  return {
    mesaId: "m1",
    mesa: "Mesa 4",
    pedidaHaceSegundos: 30,
    subtotalClp: 15900,
    descuentoClp: 0,
    importeClp: 15900,
    cobrada: false,
    pagadaHaceSegundos: null,
    cobradaPor: null,
    formaDePago: null,
    propinaClp: null,
    totalClp: null,
    ...parcial,
  }
}

const CUENTA_PEDIDA = cuenta({ id: "c1" })
const CUENTA_COBRADA = cuenta({
  id: "c2",
  mesa: "Barra 2",
  cobrada: true,
  pagadaHaceSegundos: 120,
  cobradaPor: "Camarero A",
  formaDePago: "tpv_cash",
  propinaClp: 1590,
  totalClp: 17490,
})

describe("Panel: ver y cobrar la cuenta", () => {
  it("debe listar la cuenta pedida y distinguirla de la cobrada", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/cuentas"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ listarCuentas: async () => [CUENTA_PEDIDA, CUENTA_COBRADA] })),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Mesa 4")
    expect(cuerpo).toContain("Pedida")
    expect(cuerpo).toContain("Barra 2")
    expect(cuerpo).toContain("Cobrada")
    // Quien cobro y con que.
    expect(cuerpo).toContain("Camarero A")
    expect(cuerpo).toContain("Efectivo")
  })

  it("debe enlazar la cuenta pedida desde la sala", async () => {
    const resumen: ResumenDeMesa = {
      mesa: {
        id: "m1",
        codigo: "ABCDEFGH",
        etiqueta: "Mesa 4",
        capacidad: 4,
        kind: "mesa",
        activa: true,
        zonaId: null,
        zonaNombre: null,
        posFila: 0,
        posColumna: 0,
      },
      sesionActiva: true,
      solicitudId: null,
      comandasSinServir: 0,
      cuentaId: "c1",
    }
    const respuesta = await manejar(
      await conSesion("/admin/sala"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ listarSala: async () => [resumen] })),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('href="/admin/cuentas/c1"')
    expect(cuerpo).toContain("Cuenta pedida")
  })

  it("NO debe aceptar un importe del cliente: lo ignora y solo manda forma y propina", async () => {
    let recibido: DatosDeCobro | null = null
    const respuesta = await manejar(
      await conSesion("/admin/cuentas/c1/cobrar", {
        method: "POST",
        formulario: {
          forma_pago: "tpv_cash",
          propina: "10",
          // Un atacante intenta fijar el importe por el formulario:
          importe: "1",
          total: "1",
          implemente_clp: "1",
        },
      }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          cobrar: async (_empleado, datos) => {
            recibido = datos
            return { ok: true, valor: { importeClp: 15900, propinaClp: 1590, totalClp: 17490 } }
          },
        }),
      ),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/cuentas?cobrada=1")
    // El importe falso NO llega: el contrato de `DatosDeCobro` no tiene ese campo.
    expect(recibido).toEqual({ cuentaId: "c1", formaDePago: "tpv_cash", tipPercent: 10 })
  })

  it("no debe cobrar con una forma de pago inventada", async () => {
    let llamado = false
    const respuesta = await manejar(
      await conSesion("/admin/cuentas/c1/cobrar", {
        method: "POST",
        formulario: { forma_pago: "bitcoin", propina: "10" },
      }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          listarCuentas: async () => [CUENTA_PEDIDA],
          cobrar: async () => {
            llamado = true
            return { ok: true, valor: { importeClp: 0, propinaClp: 0, totalClp: 0 } }
          },
        }),
      ),
    )
    expect(respuesta.status).toBe(400)
    expect(llamado).toBe(false)
  })

  it("no debe cobrar con una propina inventada", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/cuentas/c1/cobrar", {
        method: "POST",
        formulario: { forma_pago: "tpv_cash", propina: "7" },
      }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          listarCuentas: async () => [CUENTA_PEDIDA],
        }),
      ),
    )
    expect(respuesta.status).toBe(400)
  })

  it("NO debe dejar cobrar a un rol que no toca dinero (cocina)", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/cuentas/c1/cobrar", {
        method: "POST",
        formulario: { forma_pago: "tpv_cash", propina: "10" },
      }),
      ENTORNO,
      AHORA,
      deps(COCINA, almacenFalso({ listarCuentas: async () => [CUENTA_PEDIDA] })),
    )
    expect(respuesta.status).toBe(403)
  })

  it("no debe registrar un cobro sin sesion de personal", async () => {
    const respuesta = await manejar(
      peticion("/admin/cuentas/c1/cobrar", {
        method: "POST",
        formulario: { forma_pago: "tpv_cash", propina: "10" },
      }),
      ENTORNO,
      AHORA,
      deps(null),
    )
    expect(respuesta.status).toBe(401)
  })
})
