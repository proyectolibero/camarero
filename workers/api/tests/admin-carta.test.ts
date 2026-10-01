/**
 * Trozo 3 — La carta: categorias, platos, bebidas y fotos.
 *
 * Se prueba el enrutador completo con la sesion, el almacen y el almacen de fotos inyectados.
 * La cerradura de verdad (RLS) se prueba contra Postgres en `packages/db`; aqui se comprueba
 * que la pantalla decide bien (403 o 303) y, sobre todo, que la foto se valida por CONTENIDO
 * y se sirve como imagen, nunca como el HTML de la PWA (ADR-0030).
 */
import { beforeAll, describe, expect, it } from "vitest"
import type { Empleado } from "../src/base.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import {
  almacenCartasNoConfigurado,
  claveNueva,
  LIMITE_FOTO_BYTES,
  tipoDeImagen,
} from "../src/panel/cartas.ts"
import type {
  AlmacenPanel,
  Categoria,
  EntradaCategoria,
  EntradaPlato,
  Plato,
} from "../src/panel/datos.ts"
import {
  AHORA,
  almacenFalso,
  cartasFalsas,
  crearFirmante,
  ENTORNO,
  type Firmante,
  peticion,
} from "./apoyo.ts"

let firmante: Firmante

beforeAll(async () => {
  firmante = await crearFirmante()
})

const DUENO: Empleado = {
  staffId: "s1",
  correo: "dueno@prueba.test",
  nombre: "Dueño de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Organización de prueba" },
  local: { id: "l1", nombre: "Barra Uno" },
}

const CAMARERO: Empleado = { ...DUENO, staffId: "s2", nombre: "Garzón", rol: "server" }

const CATEGORIA: Categoria = {
  id: "c1",
  nombre: "Entrantes",
  orden: 0,
  activa: true,
  disponible: true,
}

const PLATO: Plato = {
  id: "p1",
  categoriaId: "c1",
  nombre: "Ceviche",
  descripcion: "Pescado blanco",
  precioClp: 8900,
  fotoClave: null,
  allergens: ["pescado"],
  tags: [],
  estacion: "frio",
  disponible: true,
  desde: null,
  hasta: null,
  orden: 0,
  activo: true,
}

// Un PNG de 1x1 de verdad (cabecera y todo) y tres impostores.
const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  ),
  (caracter) => caracter.charCodeAt(0),
)
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
)
const TEXTO_RENOMBRADO = new TextEncoder().encode("esto no es una imagen, solo texto")

type Espia = {
  readonly almacen: AlmacenPanel
  readonly acciones: string[]
  readonly creadasCategorias: EntradaCategoria[]
  readonly creadosPlatos: EntradaPlato[]
  readonly fotosFijadas: string[]
}

function espiaCarta(parciales: Partial<AlmacenPanel> = {}): Espia {
  const acciones: string[] = []
  const creadasCategorias: EntradaCategoria[] = []
  const creadosPlatos: EntradaPlato[] = []
  const fotosFijadas: string[] = []
  const almacen = almacenFalso({
    listarCategorias: async () => [CATEGORIA],
    leerCategoria: async (_empleado, id) => (id === CATEGORIA.id ? CATEGORIA : null),
    crearCategoria: async (_empleado, datos) => {
      creadasCategorias.push(datos)
      return { ok: true, valor: { ...CATEGORIA, id: "c2", nombre: datos.nombre } }
    },
    alternarCategoria: async (_empleado, id) => {
      acciones.push(`alternarCategoria:${id}`)
      return { ok: true, valor: undefined }
    },
    renombrarCategoria: async (_empleado, id, nombre) => {
      acciones.push(`renombrarCategoria:${id}:${nombre}`)
      return { ok: true, valor: undefined }
    },
    moverCategoria: async (_empleado, id, direccion) => {
      acciones.push(`moverCategoria:${id}:${direccion}`)
      return { ok: true, valor: undefined }
    },
    listarPlatos: async () => [PLATO],
    leerPlato: async (_empleado, id) => (id === PLATO.id ? PLATO : null),
    crearPlato: async (_empleado, datos) => {
      creadosPlatos.push(datos)
      return { ok: true, valor: { ...PLATO, id: "p2", ...datos } }
    },
    actualizarPlato: async (_empleado, id) => {
      acciones.push(`actualizarPlato:${id}`)
      return { ok: true, valor: undefined }
    },
    alternarPlato: async (_empleado, id, campo) => {
      acciones.push(`alternarPlato:${id}:${campo}`)
      return { ok: true, valor: undefined }
    },
    moverPlato: async (_empleado, id, direccion) => {
      acciones.push(`moverPlato:${id}:${direccion}`)
      return { ok: true, valor: undefined }
    },
    fijarFoto: async (_empleado, _id, clave) => {
      fotosFijadas.push(clave ?? "")
      return { ok: true, valor: null }
    },
    ...parciales,
  })
  return { almacen, acciones, creadasCategorias, creadosPlatos, fotosFijadas }
}

function deps(
  almacen: AlmacenPanel,
  empleado: Empleado | null,
  cartas = cartasFalsas().almacen,
): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [firmante.clave],
    autenticar: async () => null,
    resolverEmpleado: async () => empleado,
    almacen,
    cartas,
  }
}

async function conSesion(
  ruta: string,
  opciones: { method?: string; formulario?: Record<string, string> } = {},
) {
  return peticion(ruta, { ...opciones, cookie: await firmante.tokenPara("u1") })
}

/** Copia a un `ArrayBuffer` limpio: `Blob` no acepta una vista de buffer compartido. */
function comoArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  return copia.buffer
}

/** Peticion multipart con un archivo adjunto, como la sube el navegador. */
function peticionConArchivo(
  ruta: string,
  cookie: string,
  archivo: { readonly bytes: Uint8Array; readonly nombre: string },
): Request {
  const formulario = new FormData()
  formulario.set("foto", new File([comoArrayBuffer(archivo.bytes)], archivo.nombre))
  const cabeceras = new Headers()
  cabeceras.set("cookie", `camarero_sesion=${cookie}`)
  return new Request(`https://camarero.test${ruta}`, {
    method: "POST",
    headers: cabeceras,
    body: formulario,
  })
}

/** Alta completa: campos del formulario y, si toca, la foto, en un solo POST multipart. */
function peticionAlta(
  ruta: string,
  cookie: string,
  campos: Readonly<Record<string, string>>,
  archivo?: { readonly bytes: Uint8Array; readonly nombre: string },
): Request {
  const formulario = new FormData()
  for (const [clave, valor] of Object.entries(campos)) {
    formulario.set(clave, valor)
  }
  if (archivo !== undefined) {
    formulario.set("foto", new File([comoArrayBuffer(archivo.bytes)], archivo.nombre))
  }
  const cabeceras = new Headers()
  cabeceras.set("cookie", `camarero_sesion=${cookie}`)
  return new Request(`https://camarero.test${ruta}`, {
    method: "POST",
    headers: cabeceras,
    body: formulario,
  })
}

describe("Categorias: acceso y formulario", () => {
  it("debe llevar a la entrada sin sesion", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(peticion("/admin/carta"), ENTORNO, AHORA, deps(almacen, null))
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('action="/admin/entrar"')
  })

  it("debe listar las categorias y ofrecer crearlas al dueno", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Entrantes")
    expect(cuerpo).toContain("Crear categoría")
    expect(cuerpo).toContain('action="/admin/carta"')
  })

  it("debe mostrar solo lectura al garzon, sin formulario", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta"),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Entrantes")
    expect(cuerpo).not.toContain("Crear categoría")
  })
})

describe("Categorias: crear y cambiar", () => {
  it("debe crear una categoria y redirigir", async () => {
    const { almacen, creadasCategorias } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta", { method: "POST", formulario: { nombre: "Bebidas" } }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/carta?creada=1")
    expect(creadasCategorias).toEqual([{ nombre: "Bebidas" }])
  })

  it("no debe aceptar una categoria sin nombre", async () => {
    const { almacen, creadasCategorias } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta", { method: "POST", formulario: { nombre: "   " } }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("no puede quedar vacío")
    expect(creadasCategorias).toHaveLength(0)
  })

  it("no debe dejar crear al garzon", async () => {
    const { almacen, creadasCategorias } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta", { method: "POST", formulario: { nombre: "Bebidas" } }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
    expect(creadasCategorias).toHaveLength(0)
  })

  it("debe renombrar, alternar y mover la categoria", async () => {
    const { almacen, acciones } = espiaCarta()
    const renombrar = await manejar(
      await conSesion("/admin/carta/categoria/c1/renombrar", {
        method: "POST",
        formulario: { nombre: "Para picar" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(renombrar.status).toBe(303)
    const alternar = await manejar(
      await conSesion("/admin/carta/categoria/c1/alternar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(alternar.status).toBe(303)
    const mover = await manejar(
      await conSesion("/admin/carta/categoria/c1/mover", {
        method: "POST",
        formulario: { direccion: "bajar" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(mover.status).toBe(303)
    expect(acciones).toContain("renombrarCategoria:c1:Para picar")
    expect(acciones).toContain("alternarCategoria:c1")
    expect(acciones).toContain("moverCategoria:c1:bajar")
  })

  it("no debe admitir GET al alternar una categoria", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/categoria/c1/alternar"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})

describe("Platos: acceso y listado", () => {
  it("debe listar los platos de la categoria con precio y estado", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/c1"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Ceviche")
    expect(cuerpo).toContain("$ 8.900")
    expect(cuerpo).toContain("Disponible")
    expect(cuerpo).toContain("Añadir plato o bebida")
  })

  it("debe distinguir no disponible de desactivado", async () => {
    const { almacen } = espiaCarta({
      listarPlatos: async () => [
        { ...PLATO, id: "p2", nombre: "Agotado", disponible: false },
        { ...PLATO, id: "p3", nombre: "Retirado", activo: false },
      ],
    })
    const respuesta = await manejar(
      await conSesion("/admin/carta/c1"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Agotado")
    expect(cuerpo).toContain("Retirado")
    expect(cuerpo).toContain("carta-plato-agotado")
    expect(cuerpo).toContain("carta-plato-retirado")
  })

  it("no debe mostrar formulario de plato al garzon", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato"),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
  })
})

describe("Platos: crear y editar", () => {
  it("debe crear un plato con precio entero y estacion de barra", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato", {
        method: "POST",
        formulario: {
          nombre: "Pisco sour",
          descripcion: "Con hielo",
          precio: "5900",
          categoria: "c1",
          estacion: "bar",
          orden: "2",
          disponible: "1",
          activo: "1",
          tags: "vegano",
          alergenos: "sulfitos",
        },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/carta/c1?cambiada=1")
    expect(creadosPlatos).toHaveLength(1)
    expect(creadosPlatos[0]?.precioClp).toBe(5900)
    expect(creadosPlatos[0]?.estacion).toBe("bar")
    expect(creadosPlatos[0]?.tags).toEqual(["vegano"])
    expect(creadosPlatos[0]?.allergens).toEqual(["sulfitos"])
    expect(creadosPlatos[0]?.disponible).toBe(true)
    expect(creadosPlatos[0]?.activo).toBe(true)
  })

  it("no debe aceptar un precio con coma", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato", {
        method: "POST",
        formulario: { nombre: "Plato", precio: "4,500", categoria: "c1" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain(
      "El precio debe ser un número entero de pesos, sin decimales.",
    )
    expect(creadosPlatos).toHaveLength(0)
  })

  it("no debe aceptar un precio negativo", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato", {
        method: "POST",
        formulario: { nombre: "Plato", precio: "-100", categoria: "c1" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("sin decimales")
    expect(creadosPlatos).toHaveLength(0)
  })

  it("no debe aceptar un precio de texto", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato", {
        method: "POST",
        formulario: { nombre: "Plato", precio: "nueve", categoria: "c1" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(400)
    expect(await respuesta.text()).toContain("sin decimales")
    expect(creadosPlatos).toHaveLength(0)
  })

  it("no debe dejar crear un plato al garzon", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato", {
        method: "POST",
        formulario: { nombre: "Plato", precio: "1000", categoria: "c1" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO),
    )
    expect(respuesta.status).toBe(403)
    expect(creadosPlatos).toHaveLength(0)
  })

  it("debe editar un plato existente", async () => {
    const { almacen, acciones } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato/p1", {
        method: "POST",
        formulario: { nombre: "Ceviche nuevo", precio: "9900", categoria: "c1", activo: "1" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(acciones).toContain("actualizarPlato:p1")
  })

  it("debe duplicar una ficha con el nombre acabado en (copia)", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato/p1/duplicar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(creadosPlatos).toHaveLength(1)
    expect(creadosPlatos[0]?.nombre).toBe("Ceviche (copia)")
    expect(creadosPlatos[0]?.precioClp).toBe(8900)
  })

  it("debe alternar disponibilidad y actividad por separado", async () => {
    const { almacen, acciones } = espiaCarta()
    await manejar(
      await conSesion("/admin/carta/plato/p1/alternar", {
        method: "POST",
        formulario: { campo: "disponible" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    await manejar(
      await conSesion("/admin/carta/plato/p1/alternar", {
        method: "POST",
        formulario: { campo: "activo" },
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(acciones).toContain("alternarPlato:p1:disponible")
    expect(acciones).toContain("alternarPlato:p1:activo")
  })
})

describe("Fotos: subida y validacion por contenido", () => {
  it("debe aceptar un PNG valido, guardarlo y fijarlo en el plato", async () => {
    const { almacen, fotosFijadas } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionConArchivo("/admin/carta/plato/p1/foto", token, {
        bytes: PNG_1X1,
        nombre: "plato.png",
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/carta/plato/p1?guardado=1")
    expect(objetos.size).toBe(1)
    expect(fotosFijadas).toHaveLength(1)
    const clave = fotosFijadas[0] ?? ""
    expect(clave).toMatch(/\.png$/)
    expect(objetos.get(clave)?.tipo).toBe("image/png")
  })

  it("debe rechazar un SVG con un mensaje claro y sin guardar nada", async () => {
    const { almacen, fotosFijadas } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionConArchivo("/admin/carta/plato/p1/foto", token, {
        bytes: SVG,
        nombre: "dibujo.svg",
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(415)
    expect(await respuesta.text()).toContain("no es una imagen válida")
    expect(objetos.size).toBe(0)
    expect(fotosFijadas).toHaveLength(0)
  })

  it("debe rechazar un .jpg que no es una imagen", async () => {
    const { almacen } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionConArchivo("/admin/carta/plato/p1/foto", token, {
        bytes: TEXTO_RENOMBRADO,
        nombre: "foto.jpg",
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(415)
    expect(await respuesta.text()).toContain("no es una imagen válida")
    expect(objetos.size).toBe(0)
  })

  it("debe rechazar una foto demasiado grande antes de guardarla", async () => {
    const { almacen } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const grande = new Uint8Array(LIMITE_FOTO_BYTES + 1)
    grande.set(PNG_1X1, 0)
    const respuesta = await manejar(
      peticionConArchivo("/admin/carta/plato/p1/foto", token, {
        bytes: grande,
        nombre: "enorme.png",
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(413)
    expect(await respuesta.text()).toContain("5 MB")
    expect(objetos.size).toBe(0)
  })

  it("no debe dejar subir fotos al garzon", async () => {
    const { almacen } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionConArchivo("/admin/carta/plato/p1/foto", token, {
        bytes: PNG_1X1,
        nombre: "plato.png",
      }),
      ENTORNO,
      AHORA,
      deps(almacen, CAMARERO, cartas),
    )
    expect(respuesta.status).toBe(403)
    expect(objetos.size).toBe(0)
  })

  it("debe borrar la foto de un plato", async () => {
    const { almacen, fotosFijadas } = espiaCarta({
      leerPlato: async () => ({ ...PLATO, fotoClave: "abc.png" }),
      fijarFoto: async (_empleado, _id, clave) => {
        fotosFijadas.push(clave ?? "")
        return { ok: true, valor: "abc.png" }
      },
    })
    const { almacen: cartas, objetos } = cartasFalsas({ "abc.png": "PNG falso" })
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato/p1/foto/borrar", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(303)
    expect(fotosFijadas).toEqual([""])
    expect(objetos.has("abc.png")).toBe(false)
  })
})

describe("Fotos: servicio publico en /cartas", () => {
  it("debe servir la imagen con su tipo y NUNCA el HTML de la PWA", async () => {
    const clave = claveNueva("image/png")
    const { almacen: cartas } = cartasFalsas()
    await cartas.guardar(clave, PNG_1X1, "image/png")
    const almacen = espiaCarta().almacen
    const respuesta = await manejar(
      peticion(`/cartas/${clave}`),
      ENTORNO,
      AHORA,
      deps(almacen, null, cartas),
    )
    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get("content-type")).toBe("image/png")
    expect(respuesta.headers.get("x-content-type-options")).toBe("nosniff")
    expect(respuesta.headers.get("cache-control") ?? "").toContain("max-age=31536000")
    expect(respuesta.headers.get("content-security-policy") ?? "").toContain("default-src 'none'")
    const bytes = new Uint8Array(await respuesta.arrayBuffer())
    expect(bytes[0]).toBe(0x89)
    expect(bytes[1]).toBe(0x50)
    const comoTexto = new TextDecoder().decode(bytes.slice(0, 15))
    expect(comoTexto.toLowerCase().startsWith("<!doctype")).toBe(false)
  })

  it("debe responder 404 (no HTML) para una clave que no existe", async () => {
    const respuesta = await manejar(
      peticion("/cartas/no-existe.png"),
      ENTORNO,
      AHORA,
      deps(espiaCarta().almacen, null, cartasFalsas().almacen),
    )
    expect(respuesta.status).toBe(404)
    expect(respuesta.headers.get("content-type") ?? "").toContain("application/json")
  })

  it("no debe admitir POST en la ruta de fotos", async () => {
    const respuesta = await manejar(
      peticion("/cartas/x.png", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps(espiaCarta().almacen, null, cartasFalsas().almacen),
    )
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("GET")
  })
})

describe("Deteccion de imagen por contenido", () => {
  it("debe reconocer JPEG, PNG y WebP por sus primeros bytes", () => {
    expect(tipoDeImagen(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(tipoDeImagen(PNG_1X1)).toBe("image/png")
    expect(
      tipoDeImagen(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe("image/webp")
  })

  it("debe rechazar SVG, texto y cabeceras incompletas", () => {
    expect(tipoDeImagen(SVG)).toBeNull()
    expect(tipoDeImagen(TEXTO_RENOMBRADO)).toBeNull()
    expect(tipoDeImagen(Uint8Array.from([0xff, 0xd8]))).toBeNull()
  })
})

describe("Alta con foto en un solo envio", () => {
  it("debe crear el plato y enlazar la foto con un unico POST multipart", async () => {
    const { almacen, creadosPlatos, fotosFijadas } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionAlta(
        "/admin/carta/plato",
        token,
        { nombre: "Pisco sour", precio: "5900", categoria: "c1", estacion: "bar" },
        { bytes: PNG_1X1, nombre: "pisco.png" },
      ),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin/carta/c1?cambiada=1")
    expect(creadosPlatos).toHaveLength(1)
    expect(creadosPlatos[0]?.nombre).toBe("Pisco sour")
    expect(creadosPlatos[0]?.estacion).toBe("bar")
    expect(objetos.size).toBe(1)
    expect(fotosFijadas).toHaveLength(1)
    expect(fotosFijadas[0]).toMatch(/\.png$/)
  })

  it("no debe crear el plato si la foto es invalida y conserva lo escrito", async () => {
    const { almacen, creadosPlatos, fotosFijadas } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionAlta(
        "/admin/carta/plato",
        token,
        { nombre: "Ceviche raro", descripcion: "Con piedra", precio: "4500", categoria: "c1" },
        { bytes: SVG, nombre: "dibujo.svg" },
      ),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(415)
    expect(creadosPlatos).toHaveLength(0)
    expect(objetos.size).toBe(0)
    expect(fotosFijadas).toHaveLength(0)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("no es una imagen válida")
    expect(cuerpo).toContain("Ceviche raro")
    expect(cuerpo).toContain("Con piedra")
    expect(cuerpo).toContain("4500")
  })

  it("no debe crear el plato si la foto pasa de 5 MB y conserva lo escrito", async () => {
    const { almacen, creadosPlatos, fotosFijadas } = espiaCarta()
    const { almacen: cartas, objetos } = cartasFalsas()
    const token = await firmante.tokenPara("u1")
    const grande = new Uint8Array(LIMITE_FOTO_BYTES + 1024 * 1024)
    grande.set(PNG_1X1, 0)
    const respuesta = await manejar(
      peticionAlta(
        "/admin/carta/plato",
        token,
        { nombre: "Enorme", precio: "9900", categoria: "c1" },
        { bytes: grande, nombre: "enorme.png" },
      ),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, cartas),
    )
    expect(respuesta.status).toBe(413)
    expect(creadosPlatos).toHaveLength(0)
    expect(objetos.size).toBe(0)
    expect(fotosFijadas).toHaveLength(0)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("5 MB")
    expect(cuerpo).toContain("Enorme")
  })

  it("debe dejar el plato sin foto y avisar si el almacen no esta configurado", async () => {
    const { almacen, creadosPlatos, fotosFijadas } = espiaCarta()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionAlta(
        "/admin/carta/plato",
        token,
        { nombre: "Sin cubo", precio: "1000", categoria: "c1" },
        { bytes: PNG_1X1, nombre: "foto.png" },
      ),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO, almacenCartasNoConfigurado()),
    )
    expect(respuesta.status).toBe(500)
    expect(creadosPlatos).toHaveLength(1)
    expect(fotosFijadas).toHaveLength(0)
    expect(await respuesta.text()).toContain("no se pudo guardar la foto")
  })
})

describe("Guardar y anadir otro", () => {
  it("debe volver al formulario vacio con la categoria y la estacion usadas", async () => {
    const { almacen, creadosPlatos } = espiaCarta()
    const token = await firmante.tokenPara("u1")
    const respuesta = await manejar(
      peticionAlta("/admin/carta/plato", token, {
        nombre: "Agua mineral",
        precio: "2500",
        categoria: "c1",
        estacion: "bar",
        continuar: "otro",
      }),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(303)
    expect(creadosPlatos).toHaveLength(1)
    const location = new URL(respuesta.headers.get("location") ?? "", "https://camarero.test")
    expect(location.pathname).toBe("/admin/carta/plato")
    expect(location.searchParams.get("categoria")).toBe("c1")
    expect(location.searchParams.get("estacion")).toBe("bar")
    expect(location.searchParams.get("continuar")).toBe("1")

    const formulario = await manejar(
      await conSesion(`${location.pathname}${location.search}`),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await formulario.text()
    expect(cuerpo).toContain('name="nombre" value=""')
    expect(cuerpo).toContain('value="c1" selected')
    expect(cuerpo).toContain('value="bar" selected')
    expect(cuerpo).toContain("Puedes añadir otro")
  })
})

describe("Atajos de alta desde la carta", () => {
  it("debe ofrecer anadir plato o bebida y el atajo de bebidas sin categoria", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Añadir plato o bebida")
    expect(cuerpo).toContain("Añadir bebida")
    expect(cuerpo).toContain("estacion=bar")
    expect(cuerpo).toContain("bebida=1")
  })

  it("debe preseleccionar la categoria de bebidas cuando existe", async () => {
    const BEBIDAS: Categoria = {
      id: "c3",
      nombre: "Bebidas",
      orden: 2,
      activa: true,
      disponible: true,
    }
    const { almacen } = espiaCarta({ listarCategorias: async () => [CATEGORIA, BEBIDAS] })
    const respuesta = await manejar(
      await conSesion("/admin/carta"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(await respuesta.text()).toContain("categoria=c3")
  })

  it("debe abrir el alta con la estacion en barra y avisar si no hay bebidas", async () => {
    const { almacen } = espiaCarta()
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato?estacion=bar&bebida=1"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('enctype="multipart/form-data"')
    expect(cuerpo).toContain('name="foto"')
    expect(cuerpo).toContain('value="bar" selected')
    expect(cuerpo).toContain("categoría de bebidas")
  })

  it("debe mostrar la categoria de bebidas seleccionada en el alta por atajo", async () => {
    const BEBIDAS: Categoria = {
      id: "c3",
      nombre: "Bebidas",
      orden: 2,
      activa: true,
      disponible: true,
    }
    const { almacen } = espiaCarta({ listarCategorias: async () => [CATEGORIA, BEBIDAS] })
    const respuesta = await manejar(
      await conSesion("/admin/carta/plato?estacion=bar&bebida=1&categoria=c3"),
      ENTORNO,
      AHORA,
      deps(almacen, DUENO),
    )
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('value="c3" selected')
    expect(cuerpo).not.toContain("categoría de bebidas")
  })
})
