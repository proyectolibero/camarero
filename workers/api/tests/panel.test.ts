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
import { type DependenciasParciales, manejar } from "../src/enrutador.ts"
import type { Autenticador, ResolvedorDeEmpleado } from "../src/panel/proveedor.ts"
import { ERROR_CREDENCIALES } from "../src/panel/rutas.ts"

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
  readonly formulario?: Readonly<Record<string, string>>
}

function peticion(ruta: string, opciones: OpcionesPeticion = {}): Request {
  const cabeceras = new Headers()
  if (opciones.cookie !== undefined) {
    cabeceras.set("cookie", `camarero_sesion=${opciones.cookie}`)
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

  it("no debe dejar palabras sin tilde en el texto que ve el usuario", async () => {
    const token = await tokenPara("u1")
    const paginas = [
      await manejar(peticion("/admin"), ENTORNO, AHORA, deps({})),
      await manejar(
        peticion("/admin/entrar", {
          method: "POST",
          formulario: { correo: "nadie@prueba.test", contrasena: "mala" },
        }),
        ENTORNO,
        AHORA,
        deps({}),
      ),
      await manejar(
        peticion("/admin", { cookie: token }),
        ENTORNO,
        AHORA,
        deps({ resolverEmpleado: async () => DUENO }),
      ),
      await manejar(
        peticion("/panel", { cookie: token }),
        ENTORNO,
        AHORA,
        deps({ resolverEmpleado: async () => PLATAFORMA }),
      ),
      await manejar(
        peticion("/admin", { cookie: token }),
        ENTORNO,
        AHORA,
        deps({ resolverEmpleado: async () => PLATAFORMA }),
      ),
    ]
    for (const respuesta of paginas) {
      expect(faltasDeOrtografia(textoVisible(await respuesta.text()))).toEqual([])
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
})

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
