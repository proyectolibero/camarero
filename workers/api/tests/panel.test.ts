/**
 * Rutas del panel: entrada, cuadro, permiso denegado y salida.
 *
 * Se prueba el enrutador completo, con la fuente de claves, el autenticador y el resolvedor de
 * la ficha inyectados: ninguna prueba sale a la red ni toca la base. Cuando hace falta una
 * sesión válida se firma un pasaporte ES256 de verdad y se verifica contra una clave pública
 * generada en la propia prueba.
 */
import { beforeAll, describe, expect, it } from "vitest"
import { aBytes, bytesABase64Url } from "../src/auth/base64.ts"
import type { ClaveDeFirma } from "../src/auth/jwks.ts"
import type { Empleado } from "../src/base.ts"
import type { AlmacenComensal, CartaDelComensal, PedidoDelComensal } from "../src/comensal/datos.ts"
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import { SIN_CATEGORIA } from "../src/panel/carta-catalogo.ts"
import type { AlmacenPanel, Mesa } from "../src/panel/datos.ts"
import type { Autenticador, ResolvedorDeEmpleado } from "../src/panel/proveedor.ts"
import { ERROR_CREDENCIALES } from "../src/panel/rutas.ts"
import { almacenFalso, comensalFalso } from "./apoyo.ts"

const AHORA = new Date("2026-09-30T12:00:00.000Z")
const KID = "clave-de-prueba"
const ENTORNO = { SUPABASE_URL: "https://proyecto.test" }

let claveDeFirma: ClaveDeFirma
let privada: CryptoKey

beforeAll(async () => {
  const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])
  privada = par.privateKey
  claveDeFirma = {
    kid: KID,
    alg: "ES256",
    jwk: await crypto.subtle.exportKey("jwk", par.publicKey),
  }
})

async function tokenPara(sub: string): Promise<string> {
  const cabecera = bytesABase64Url(aBytes(JSON.stringify({ alg: "ES256", typ: "JWT", kid: KID })))
  const exp = Math.floor(AHORA.getTime() / 1000) + 3600
  const cuerpo = bytesABase64Url(aBytes(JSON.stringify({ sub, exp })))
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privada,
    aBytes(`${cabecera}.${cuerpo}`),
  )
  return `${cabecera}.${cuerpo}.${bytesABase64Url(new Uint8Array(firma))}`
}

const DUENO: Empleado = {
  staffId: "s1",
  correo: "dueno@prueba.test",
  nombre: "Dueño de prueba",
  rol: "org_owner",
  organizacion: { id: "o1", nombre: "Local de prueba" },
  local: { id: "l1", nombre: "Local de prueba" },
}

const COCINA: Empleado = {
  staffId: "s2",
  correo: "cocina@prueba.test",
  nombre: "Cocina de prueba",
  rol: "kitchen",
  organizacion: { id: "o1", nombre: "Local de prueba" },
  local: { id: "l1", nombre: "Local de prueba" },
}

const PLATAFORMA: Empleado = {
  staffId: "s3",
  correo: "plataforma@prueba.test",
  nombre: "Equipo de plataforma",
  rol: "platform_admin",
  organizacion: { id: "o9", nombre: "Plataforma" },
  local: null,
}

/** Los seis códigos del `check` de 0003_personal_y_roles.sql, para cubrirlos todos. */
const ROLES_DE_PRUEBA = [
  "platform_admin",
  "org_owner",
  "location_manager",
  "server",
  "kitchen",
  "no_pin",
] as const

const AUTENTICA: Autenticador = async () => ({ token: "pasaporte-falso", expiraEnSegundos: 3600 })

type OpcionesPeticion = {
  readonly method?: string
  readonly cookie?: string
  readonly cookieMesa?: string
  readonly cookieCesta?: string
  readonly formulario?: Readonly<Record<string, string>>
}

function peticion(ruta: string, opciones: OpcionesPeticion = {}): Request {
  const cabeceras = new Headers()
  const cookies: string[] = []
  if (opciones.cookie !== undefined) {
    cookies.push(`camarero_sesion=${opciones.cookie}`)
  }
  if (opciones.cookieMesa !== undefined) {
    cookies.push(`camarero_mesa=${opciones.cookieMesa}`)
  }
  if (opciones.cookieCesta !== undefined) {
    cookies.push(`camarero_cesta=${opciones.cookieCesta}`)
  }
  if (cookies.length > 0) {
    cabeceras.set("cookie", cookies.join("; "))
  }
  let cuerpo: string | undefined
  if (opciones.formulario !== undefined) {
    cabeceras.set("content-type", "application/x-www-form-urlencoded")
    cuerpo = new URLSearchParams(opciones.formulario).toString()
  }
  return new Request(`https://camarero.test${ruta}`, {
    method: opciones.method ?? "GET",
    headers: cabeceras,
    body: cuerpo,
  })
}

function deps(opciones: {
  readonly autenticar?: Autenticador
  readonly resolverEmpleado?: ResolvedorDeEmpleado
  readonly almacen?: AlmacenPanel
  readonly comensal?: AlmacenComensal
}): DependenciasParciales {
  return {
    fuenteDeClaves: async () => [claveDeFirma],
    autenticar: opciones.autenticar ?? (async () => null),
    // Por defecto, resolver la ficha es un error: una prueba que la necesite la inyecta.
    resolverEmpleado:
      opciones.resolverEmpleado ??
      (async () => {
        throw new Error("la ficha no deberia resolverse en esta prueba")
      }),
    almacen: opciones.almacen,
    comensal: opciones.comensal,
  }
}

describe("Panel: sin sesion", () => {
  it("debe mostrar el formulario de entrada en /admin", async () => {
    const respuesta = await manejar(peticion("/admin"), ENTORNO, AHORA, deps({}))
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain('action="/admin/entrar"')
    expect(cuerpo).toContain('name="correo"')
  })

  it("debe mostrar el formulario de entrada en /panel", async () => {
    const respuesta = await manejar(peticion("/panel"), ENTORNO, AHORA, deps({}))
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain('action="/panel/entrar"')
  })
})

describe("Panel: entrada", () => {
  it("debe dejar la cookie y redirigir cuando las credenciales son correctas", async () => {
    const respuesta = await manejar(
      peticion("/admin/entrar", {
        method: "POST",
        formulario: { correo: "dueno@prueba.test", contrasena: "secreta" },
      }),
      ENTORNO,
      AHORA,
      deps({ autenticar: AUTENTICA }),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin")
    const cookie = respuesta.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("camarero_sesion=pasaporte-falso")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain("SameSite=Lax")
    expect(cookie).toContain("Path=/")
    expect(cookie).toContain("Max-Age=3600")
  })

  it("debe rehacer el formulario con aviso generico cuando las credenciales no valen", async () => {
    const respuesta = await manejar(
      peticion("/admin/entrar", {
        method: "POST",
        formulario: { correo: "dueno@prueba.test", contrasena: "mala" },
      }),
      ENTORNO,
      AHORA,
      deps({}),
    )
    expect(respuesta.status).toBe(401)
    expect(await respuesta.text()).toContain(ERROR_CREDENCIALES)
    expect(respuesta.headers.get("set-cookie")).toBeNull()
  })

  it("no debe distinguir un correo inexistente de una contrasena incorrecta", async () => {
    const autenticar: Autenticador = async () => null
    const malaContrasena = await manejar(
      peticion("/admin/entrar", {
        method: "POST",
        formulario: { correo: "dueno@prueba.test", contrasena: "mala" },
      }),
      ENTORNO,
      AHORA,
      deps({ autenticar }),
    )
    const correoInexistente = await manejar(
      peticion("/admin/entrar", {
        method: "POST",
        formulario: { correo: "nadie@prueba.test", contrasena: "mala" },
      }),
      ENTORNO,
      AHORA,
      deps({ autenticar }),
    )
    expect(malaContrasena.status).toBe(correoInexistente.status)
    expect(await malaContrasena.text()).toBe(await correoInexistente.text())
  })

  it("debe responder 405 cuando se entra con GET", async () => {
    const respuesta = await manejar(peticion("/admin/entrar"), ENTORNO, AHORA, deps({}))
    expect(respuesta.status).toBe(405)
    expect(respuesta.headers.get("allow")).toBe("POST")
  })
})

describe("Panel: salida", () => {
  it("debe borrar la cookie y volver a la entrada", async () => {
    const respuesta = await manejar(
      peticion("/admin/salir", { method: "POST" }),
      ENTORNO,
      AHORA,
      deps({}),
    )
    expect(respuesta.status).toBe(303)
    expect(respuesta.headers.get("location")).toBe("/admin")
    expect(respuesta.headers.get("set-cookie") ?? "").toContain("Max-Age=0")
  })
})

describe("Panel: con sesion", () => {
  it("debe mostrar el cuadro con nombre, rol, local y organizacion", async () => {
    const token = await tokenPara("u1")
    const respuesta = await manejar(
      peticion("/admin", { cookie: token }),
      ENTORNO,
      AHORA,
      deps({ resolverEmpleado: async () => DUENO }),
    )
    expect(respuesta.status).toBe(200)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Hola, Dueño de prueba")
    expect(cuerpo).toContain("<dd>Dueño</dd>")
    expect(cuerpo).not.toContain("org_owner")
    expect(cuerpo).toContain("Local de prueba")
    expect(cuerpo).toContain("Carta (categorías, platos, precios, fotos, orden)")
  })

  it("no debe incluir el pasaporte en el HTML", async () => {
    const token = await tokenPara("u1")
    const respuesta = await manejar(
      peticion("/admin", { cookie: token }),
      ENTORNO,
      AHORA,
      deps({ resolverEmpleado: async () => DUENO }),
    )
    expect(await respuesta.text()).not.toContain(token)
  })

  it("debe mostrar permiso denegado cuando el rol no basta para /panel", async () => {
    const token = await tokenPara("u1")
    const respuesta = await manejar(
      peticion("/panel", { cookie: token }),
      ENTORNO,
      AHORA,
      deps({ resolverEmpleado: async () => COCINA }),
    )
    expect(respuesta.status).toBe(403)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("No tienes acceso a este panel")
    expect(cuerpo).toContain("rol Cocina")
    expect(cuerpo).not.toContain("kitchen")
  })

  it("debe negar /admin a platform_admin y senalarle su panel", async () => {
    const token = await tokenPara("u1")
    const respuesta = await manejar(
      peticion("/admin", { cookie: token }),
      ENTORNO,
      AHORA,
      deps({ resolverEmpleado: async () => PLATAFORMA }),
    )
    expect(respuesta.status).toBe(403)
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Administración de plataforma")
    expect(cuerpo).not.toContain("platform_admin")
    expect(cuerpo).toContain('href="/panel"')
  })

  it("debe dejar entrar a platform_admin en /panel", async () => {
    const token = await tokenPara("u1")
    const respuesta = await manejar(
      peticion("/panel", { cookie: token }),
      ENTORNO,
      AHORA,
      deps({ resolverEmpleado: async () => PLATAFORMA }),
    )
    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toContain("Equipo de plataforma")
  })
})

describe("Panel: hoja de estilos y cabeceras", () => {
  it("debe servir la hoja como CSS cacheable", async () => {
    const respuesta = await manejar(peticion("/panel/estilos.css"), ENTORNO, AHORA, deps({}))
    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get("content-type")).toContain("text/css")
    expect(respuesta.headers.get("cache-control") ?? "").toContain("max-age")
  })

  it("no debe admitir unsafe-inline ni unsafe-eval en el CSP", async () => {
    const respuesta = await manejar(peticion("/admin"), ENTORNO, AHORA, deps({}))
    const csp = respuesta.headers.get("content-security-policy") ?? ""
    expect(csp).not.toContain("unsafe-inline")
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).toContain("style-src 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(respuesta.headers.get("x-content-type-options")).toBe("nosniff")
    expect(respuesta.headers.get("strict-transport-security") ?? "").toContain("max-age=")
  })
})

describe("Panel: ortografía en español correcto", () => {
  it("debe rotular el campo de contraseña con eñe y tilde", async () => {
    const respuesta = await manejar(peticion("/admin"), ENTORNO, AHORA, deps({}))
    const cuerpo = await respuesta.text()
    expect(cuerpo).toContain("Contraseña")
    expect(cuerpo).toContain("Correo electrónico")
    expect(cuerpo).not.toContain("Contrasena")
  })

  it("no debe dejar palabras sin tilde en NINGUNA pantalla, incluida la del comensal", async () => {
    const token = await tokenPara("u1")
    const almacen = almacenFalso({
      leerLocal: async () => ({
        id: "l1",
        orgId: "o1",
        nombre: "Local de prueba",
        slug: "local-de-prueba",
        timezone: "America/Santiago",
        currency: "CLP",
        status: "active",
        serviceMode: "dine_in",
      }),
      listarSala: async () => [resumenDeSala()],
      listarComandasDeMesa: async () => [],
    })
    const rutasDelPanel = [
      "/admin",
      "/admin/local",
      "/admin/zonas",
      "/admin/mesas",
      "/admin/mesas/qr",
      "/admin/carta",
      "/admin/carta/plato",
      `/admin/carta/${SIN_CATEGORIA}`,
      "/admin/puestos",
      "/admin/sala",
      "/admin/sala/m1",
      "/admin/pedidos",
      "/admin/pedidos/todo",
      "/admin/parejas",
      "/admin/sala/inexistente",
      "/admin/carta/plato/inexistente",
    ]
    const paginas: string[] = []
    for (const ruta of rutasDelPanel) {
      const respuesta = await manejar(
        peticion(ruta, { cookie: token }),
        ENTORNO,
        AHORA,
        deps({ resolverEmpleado: async () => DUENO, almacen }),
      )
      paginas.push(textoVisible(await respuesta.text()))
    }
    // La entrada y el error de credenciales, sin sesion.
    paginas.push(
      textoVisible(await (await manejar(peticion("/admin"), ENTORNO, AHORA, deps({}))).text()),
    )
    paginas.push(
      textoVisible(
        await (
          await manejar(
            peticion("/admin/entrar", {
              method: "POST",
              formulario: { correo: "nadie@prueba.test", contrasena: "mala" },
            }),
            ENTORNO,
            AHORA,
            deps({}),
          )
        ).text(),
      ),
    )
    // El panel de plataforma.
    paginas.push(
      textoVisible(
        await (
          await manejar(
            peticion("/panel", { cookie: token }),
            ENTORNO,
            AHORA,
            deps({ resolverEmpleado: async () => PLATAFORMA }),
          )
        ).text(),
      ),
    )

    // El comensal: carta, cesta, pedidos, código desconocido, local sin abrir y sesión cerrada.
    // Se guardan aparte porque el texto del comensal tiene una criba adicional: no puede dar
    // por hecho que toda la comanda va a la cocina (LL-025, ADR-0033/0034).
    const paginasDelComensal: string[] = []
    const conCarta = deps({ comensal: comensalFalso({ abrir: async () => lecturaDeCarta() }) })
    paginasDelComensal.push(
      textoVisible(await (await manejar(peticion("/t/ABCDEFGH"), ENTORNO, AHORA, conCarta)).text()),
    )
    paginasDelComensal.push(
      textoVisible(
        await (
          await manejar(
            peticion("/t/ABCDEFGH/cesta", { cookieCesta: `${PLATO_ID}:2` }),
            ENTORNO,
            AHORA,
            conCarta,
          )
        ).text(),
      ),
    )
    paginasDelComensal.push(
      textoVisible(
        await (
          await manejar(
            peticion("/t/ABCDEFGH/pedidos", { cookieMesa: "sesion" }),
            ENTORNO,
            AHORA,
            deps({
              comensal: comensalFalso({
                pedidos: async () => ({
                  tipo: "ok",
                  local: "Barra Uno",
                  mesa: "Mesa 4",
                  pedidos: [pedidoDeEjemplo()],
                  subtotalAcumuladoClp: 17800,
                  cuentaPedida: false,
                }),
              }),
            }),
          )
        ).text(),
      ),
    )
    paginasDelComensal.push(
      textoVisible(
        await (
          await manejar(
            peticion("/t/ABCDEFGH", { cookieMesa: "sesion-cerrada" }),
            ENTORNO,
            AHORA,
            deps({ comensal: comensalFalso({ abrir: async () => ({ tipo: "sesion_cerrada" }) }) }),
          )
        ).text(),
      ),
    )
    paginasDelComensal.push(
      textoVisible(
        await (
          await manejar(
            peticion("/t/ABCDEFGH", { cookieMesa: "local-cerrado" }),
            ENTORNO,
            AHORA,
            deps({ comensal: comensalFalso({ abrir: async () => ({ tipo: "local_inactivo" }) }) }),
          )
        ).text(),
      ),
    )
    paginasDelComensal.push(
      textoVisible(await (await manejar(peticion("/t/ZZZZZZZZ"), ENTORNO, AHORA, deps({}))).text()),
    )

    for (const pagina of [...paginas, ...paginasDelComensal]) {
      expect(faltasDeOrtografia(pagina)).toEqual([])
    }
    for (const pagina of paginasDelComensal) {
      expect(afirmacionesDeCocina(pagina)).toEqual([])
    }

    // Los seis rótulos de rol se dibujan y pasan por la misma criba (D-043).
    for (const rol of ROLES_DE_PRUEBA) {
      const respuesta = await manejar(
        peticion("/admin", { cookie: token }),
        ENTORNO,
        AHORA,
        deps({ resolverEmpleado: async () => ({ ...DUENO, rol }) }),
      )
      expect(faltasDeOrtografia(textoVisible(await respuesta.text()))).toEqual([])
    }
  })

  it("debe saber fallar: una palabra sin tilde se detecta como falta", () => {
    expect(faltasDeOrtografia("Esta sesion no lleva tilde")).toContain("sesion")
    expect(faltasDeOrtografia("La sesión correcta pasa la criba")).toEqual([])
  })

  it("debe saber fallar: un texto que manda la comanda a la cocina se detecta", () => {
    expect(afirmacionesDeCocina("Enviar a cocina")).toContain("enviar a cocina")
    expect(afirmacionesDeCocina("Tu comanda va a la cocina")).toContain("a la cocina")
    // El aviso legítimo sí nombra la cocina, pero como un puesto entre varios: no es un fallo.
    expect(afirmacionesDeCocina("la cocina y la barra lo preparan por separado")).toEqual([])
  })
})

const PLATO_ID = "04000000-0000-0000-0000-000000000001"

const MESA_DE_SALA: Mesa = {
  id: "m1",
  codigo: "ABCDEFGH",
  etiqueta: "Sala 1",
  capacidad: 4,
  kind: "mesa",
  activa: true,
  zonaId: "z1",
  zonaNombre: "Sala",
  posFila: 0,
  posColumna: 0,
}

function resumenDeSala() {
  return {
    mesa: MESA_DE_SALA,
    sesionActiva: true,
    solicitudId: null,
    comandasSinServir: 1,
    cuentaId: null,
  }
}

function lecturaDeCarta(): {
  readonly tipo: "ok"
  readonly sesionId: string
  readonly carta: CartaDelComensal
} {
  return {
    tipo: "ok",
    sesionId: "sesion-de-prueba",
    carta: {
      local: "Barra Uno",
      mesa: "Mesa 4",
      estado: "aprobado",
      restanteSegundos: null,
      subtotalAcumuladoClp: 17800,
      cuentaPedida: false,
      categorias: [
        {
          id: "c1",
          nombre: "Entrantes",
          platos: [
            {
              id: PLATO_ID,
              nombre: "Ceviche clásico",
              descripcion: "Con limón de pica y cilantro.",
              precioClp: 8900,
              fotoClave: null,
              puestoId: "pu-frio",
              puestoNombre: "Frío",
              autoAcepta: false,
            },
          ],
        },
      ],
    },
  }
}

function pedidoDeEjemplo(): PedidoDelComensal {
  return {
    id: "o1",
    destino: "Frío",
    estado: "pendiente",
    creadoHaceSegundos: 6,
    lineas: [{ nombre: "Ceviche clásico", cantidad: 2, totalClp: 17800 }],
    totalClp: 17800,
  }
}

/** Deja solo lo que ve el usuario: sustituye cada etiqueta por un espacio. */
function textoVisible(pagina: string): string {
  return pagina.replace(/<[^>]*>/g, " ")
}

// Palabras que, escritas sin tilde, delatan un texto que no pasó por el español correcto (D-043).
const PALABRAS_SIN_TILDE = [
  "contrasena",
  "sesion",
  "organizacion",
  "informacion",
  "direccion",
  "atencion",
  "tambien",
  "despues",
  "ademas",
  "numero",
  "telefono",
  "dia",
  "dias",
  "proximo",
  "ultimo",
  "aqui",
  "asi",
] as const

/** Devuelve las palabras sin tilde encontradas como palabras completas (no parte de otra). */
function faltasDeOrtografia(texto: string): readonly string[] {
  return PALABRAS_SIN_TILDE.filter((palabra) => new RegExp(`\\b${palabra}\\b`, "i").test(texto))
}

// Frases del comensal que dan por hecho que TODA la comanda va a la cocina. Desde ADR-0033 y
// ADR-0034 la comanda se reparte por puestos (LL-025): un texto no puede presuponer un único
// destino llamado «cocina». Nombres de puesto concretos sí son válidos si van entre varios.
const COCINA_COMO_UNICO_DESTINO = [
  "enviar a cocina",
  "enviada a cocina",
  "va a la cocina",
  "va a cocina",
  "a la cocina",
] as const

/** Devuelve las frases que presuponen la cocina como único destino de la comanda. */
function afirmacionesDeCocina(texto: string): readonly string[] {
  const plano = texto.toLowerCase()
  return COCINA_COMO_UNICO_DESTINO.filter((frase) => plano.includes(frase))
}
