/**
 * Entrada del personal: el borde como intermediario ante el proveedor de identidad.
 *
 * El navegador nunca habla con Supabase Auth ni ve jamas el pasaporte (ADR-0024). El borde
 * presenta correo y contrasena a `POST /auth/v1/token?grant_type=password` con la clave
 * anonima del proyecto en la cabecera `apikey`, y guarda el pasaporte resultante en la cookie
 * opaca. NUNCA se registra el correo, la contrasena ni el pasaporte.
 */
import type { FuenteDeClaves } from "../auth/jwks.ts"
import type { Empleado } from "../base.ts"

/** Pasaporte recien emitido y lo que le queda de vida, para el Max-Age de la cookie. */
export type Pasaporte = {
  readonly token: string
  readonly expiraEnSegundos: number
}

/** Presenta unas credenciales al proveedor. `null` significa que no valen. */
export type Autenticador = (correo: string, contrasena: string) => Promise<Pasaporte | null>

/** Resuelve la ficha del empleado a partir del `sub` ya verificado del pasaporte. */
export type ResolvedorDeEmpleado = (usuarioDeAuth: string) => Promise<Empleado | null>

/** Todo lo que sale a la red, inyectable para que las pruebas no la toquen. */
export type Dependencias = {
  readonly fuenteDeClaves: FuenteDeClaves
  readonly autenticar: Autenticador
  readonly resolverEmpleado: ResolvedorDeEmpleado
}

type EntornoDeIdentidad = {
  readonly SUPABASE_URL?: string
  readonly SUPABASE_ANON_KEY?: string
}

function interpretarPasaporte(cuerpo: unknown): Pasaporte | null {
  if (typeof cuerpo !== "object" || cuerpo === null) {
    return null
  }
  const { access_token: token, expires_in: segundos } = cuerpo as Record<string, unknown>
  if (typeof token !== "string" || token === "" || typeof segundos !== "number" || segundos <= 0) {
    return null
  }
  return { token, expiraEnSegundos: segundos }
}

/** Autenticador real: una llamada a Supabase Auth. */
export function autenticadorDeSupabase(urlBase: string, claveAnonima: string): Autenticador {
  const raiz = urlBase.replace(/\/+$/, "")
  return async (correo, contrasena) => {
    const respuesta = await fetch(`${raiz}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: claveAnonima },
      body: JSON.stringify({ email: correo, password: contrasena }),
    })
    if (!respuesta.ok) {
      return null
    }
    return interpretarPasaporte(await respuesta.json())
  }
}

/**
 * Autenticador segun el entorno. Sin `SUPABASE_URL` ni `SUPABASE_ANON_KEY` no se puede juzgar
 * ninguna credencial: se falla el intento, nunca se inventa una sesion.
 */
export function autenticadorDeEntorno(entorno: EntornoDeIdentidad): Autenticador {
  const url = entorno.SUPABASE_URL
  const clave = entorno.SUPABASE_ANON_KEY
  if (url === undefined || url === "" || clave === undefined || clave === "") {
    return async () => null
  }
  return autenticadorDeSupabase(url, clave)
}
