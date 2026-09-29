/**
 * PIN de dispositivo: se guarda como hash, nunca en claro.
 *
 * El PIN es un mecanismo aparte del panel: la tablet del camarero presenta el token del
 * aparato y un PIN, y el borde comprueba el hash. No depende de la sesion de Supabase.
 *
 * Se usa PBKDF2-SHA256, disponible en Web Crypto tanto en Workers como en Node, con sal
 * aleatoria por empleado y muchas iteraciones para que probar PINes a lo bruto sea caro.
 * La defensa principal contra el sondeo, en cualquier caso, es el bloqueo por intentos
 * (staff_devices.pin_fail_count y locked_until): un PIN de cuatro cifras tiene diez mil
 * combinaciones, y lo que lo protege de verdad es que se agote el numero de intentos.
 */
import { aBytes, base64UrlABytes, bytesABase64Url, compararEnTiempoConstante } from "./base64.ts"

const ETIQUETA = "pbkdf2-sha256"
const ITERACIONES_POR_DEFECTO = 100_000
const LONGITUD_SAL_BYTES = 16
const LONGITUD_CLAVE_BITS = 256

async function derivarClave(
  pin: string,
  sal: Uint8Array<ArrayBuffer>,
  iteraciones: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey("raw", aBytes(pin), "PBKDF2", false, [
    "deriveBits",
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" },
    material,
    LONGITUD_CLAVE_BITS,
  )
  return new Uint8Array(bits)
}

/** Devuelve el hash en formato `pbkdf2-sha256$iteraciones$sal$clave`, todo en base64url. */
export async function hashearPin(
  pin: string,
  iteraciones = ITERACIONES_POR_DEFECTO,
): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(LONGITUD_SAL_BYTES))
  const clave = await derivarClave(pin, sal, iteraciones)
  return `${ETIQUETA}$${iteraciones}$${bytesABase64Url(sal)}$${bytesABase64Url(clave)}`
}

type HashDesglosado = {
  readonly iteraciones: number
  readonly sal: Uint8Array<ArrayBuffer>
  readonly clave: Uint8Array<ArrayBuffer>
}

function desglosar(almacenado: string): HashDesglosado | null {
  const partes = almacenado.split("$")
  if (partes.length !== 4 || partes[0] !== ETIQUETA) {
    return null
  }
  const iteraciones = Number(partes[1])
  if (!Number.isInteger(iteraciones) || iteraciones <= 0 || iteraciones > 10_000_000) {
    return null
  }
  const sal = partes[2]
  const clave = partes[3]
  if (sal === undefined || clave === undefined) {
    return null
  }
  try {
    return { iteraciones, sal: base64UrlABytes(sal), clave: base64UrlABytes(clave) }
  } catch {
    // Un hash corrupto no debe reventar el inicio de sesion: se trata como no valido.
    return null
  }
}

export async function verificarPin(pin: string, almacenado: string): Promise<boolean> {
  const desglose = desglosar(almacenado)
  if (desglose === null) {
    return false
  }
  const calculada = await derivarClave(pin, desglose.sal, desglose.iteraciones)
  return compararEnTiempoConstante(calculada, desglose.clave)
}
