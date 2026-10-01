/**
 * El panel del local para decidir las solicitudes de emparejamiento.
 *
 * Se prueba el enrutador completo con la ficha del empleado y el almacen inyectados. La
 * cerradura de verdad (que un empleado de otro local no pueda decidir) es de base y se prueba
 * en `packages/db/tests/comensal.test.ts`; aqui se demuestra que la pantalla existe, que
 * aprueba y rechaza por POST, y que no promete lo que la base no concede.
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import type { DependenciasParciales } from "../src/enrutador.ts"
import { manejar } from "../src/enrutador.ts"
import { AHORA, almacenFalso, crearFirmante, ENTORNO, type Firmante, peticion } from "./apoyo.ts"

const DUENO: Empleado = {
  staffId: "s1",
  correo: "duena@camarero.test",
  nombre: "Dueña de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Restaurante de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

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

const PENDIENTES = [
  { id: "s1", mesa: "Mesa 4", pedidaHaceSegundos: 5, restanteSegundos: 85 },
  { id: "s2", mesa: "Barra 2", pedidaHaceSegundos: 20, restanteSegundos: 70 },
]

describe("Solicitudes: la pantalla", () => {
  it("debe mostrar la entrada si no hay sesion", async () => {
    const respuesta = await manejar(peticion("/admin/parejas"), ENTORNO, AHORA, deps(null))
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('action="/admin/entrar"')
  })

  it("debe listar las solicitudes pendientes con su mesa y su tiempo", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/parejas"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ listarParejasPendientes: async () => PENDIENTES })),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Mesa 4")
    expect(cuerpo).toContain("Barra 2")
    expect(cuerpo).toContain("Aprobar")
    expect(cuerpo).toContain("Rechazar")
    expect(cuerpo).toContain("quedan")
  })

  it("debe decir cuando no hay ninguna pendiente", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/parejas"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ listarParejasPendientes: async () => [] })),
    )
    expect(await respuesta.text()).toContain("No hay solicitudes pendientes")
  })
})

describe("Solicitudes: aprobar y rechazar por POST", () => {
  it("debe aprobar y volver a la lista", async () => {
    let aprobada: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/parejas/s1/aprobar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          aprobarPareja: async (_empleado, id) => {
            aprobada = id
            return { ok: true, valor: undefined }
          },
        }),
      ),
    )
    expect(aprobada).toBe("s1")
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/parejas?aprobada=1")
  })

  it("debe rechazar con su motivo y volver a la lista", async () => {
    let motivoVisto: string | null = null
    const respuesta = await manejar(
      await conSesion("/admin/parejas/s2/rechazar", {
        method: "POST",
        formulario: { motivo: "No es la mesa correcta" },
      }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          rechazarPareja: async (_empleado, _id, motivo) => {
            motivoVisto = motivo
            return { ok: true, valor: undefined }
          },
        }),
      ),
    )
    expect(motivoVisto).toBe("No es la mesa correcta")
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/parejas?rechazada=1")
  })

  it("debe avisar con 409 si la solicitud ya no esta pendiente", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/parejas/s1/aprobar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(
        DUENO,
        almacenFalso({
          aprobarPareja: async () => ({ ok: false, motivo: "no_existe" }),
          listarParejasPendientes: async () => [],
        }),
      ),
    )
    expect(respuesta.status).toBe(409)
    expect(await respuesta.text()).toContain("ya no está pendiente")
  })

  it("no debe admitir GET en la accion", async () => {
    const respuesta = await manejar(
      await conSesion("/admin/parejas/s1/aprobar"),
      ENTORNO,
      AHORA,
      deps(DUENO),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})

describe("Solicitudes: el enlace del cuadro de mando", () => {
  it("debe enlazar a las solicitudes con el numero de pendientes", async () => {
    const respuesta = await manejar(
      await conSesion("/admin"),
      ENTORNO,
      AHORA,
      deps(DUENO, almacenFalso({ contarParejasPendientes: async () => 3 })),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('href="/admin/parejas"')
    expect(cuerpo).toContain("(3)")
  })
})
