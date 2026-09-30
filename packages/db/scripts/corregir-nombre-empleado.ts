/**
 * CORRIGE EL NOMBRE VISIBLE DE UNA FICHA DE STAFF, DIRIGIDA POR CORREO.
 *
 * Es una operación deliberada sobre datos reales, por eso vive detrás de un flujo de trabajo
 * manual (`.github/workflows/corregir-nombre-empleado.yml`) que aporta los secretos de
 * administración. Se conecta como ADMINISTRACIÓN y confía en la CA pública de Supabase: NUNCA
 * desactiva la verificación TLS. Imprime la sentencia y el recuento de filas; jamás
 * credenciales.
 */
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"

// Certificado raíz PUBLICO de Supabase, incluido para no desactivar la verificación.
const RUTA_CA_POR_DEFECTO = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url))

const EMAIL_POR_DEFECTO = "dueno@prueba.test"
const NOMBRE_POR_DEFECTO = "Dueño de prueba"

// La sentencia va parametrizada: el correo y el nombre nunca se interpolan en el SQL.
const SENTENCIA = "update public.staff set display_name = $2 where email = $1"

async function leerAutoridadCertificadora(): Promise<string> {
  return readFile(process.env.CAMARERO_DB_CA ?? RUTA_CA_POR_DEFECTO, "utf8")
}

function parametrosDesdeUrl(
  url: string,
  ca: string,
  contrasenaSeparada?: string,
): ParametrosConexion {
  const partes = new URL(url)
  const usuario = decodeURIComponent(partes.username)
  // La contrasena en su propio secreto evita el baile de codificarla dentro de una URL.
  const contrasena = contrasenaSeparada ?? decodeURIComponent(partes.password)
  if (usuario === "" || contrasena === "") {
    throw new Error("La cadena de conexion no trae usuario, o falta la contrasena")
  }
  const ruta = partes.pathname.replace(/^\//, "")
  return {
    host: partes.hostname,
    port: partes.port === "" ? 5432 : Number(partes.port),
    database: ruta === "" ? "postgres" : ruta,
    user: usuario,
    password: contrasena,
    // TLS obligatorio, con verificacion del certificado contra la CA de Supabase.
    ssl: true,
    ca,
    timeoutMs: 20_000,
  }
}

function leerVariable(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre]
  return valor === undefined || valor.trim() === "" ? porDefecto : valor.trim()
}

const url = process.env.CAMARERO_DB_URL_ADMIN
const contrasena = process.env.CAMARERO_DB_PASSWORD_ADMIN
if (url === undefined || url === "") {
  throw new Error(
    "Falta la variable CAMARERO_DB_URL_ADMIN con la cadena de conexion del administrador",
  )
}
if (contrasena === undefined || contrasena === "") {
  throw new Error(
    "Falta la variable CAMARERO_DB_PASSWORD_ADMIN con la contrasena del administrador",
  )
}

const email = leerVariable("CAMARERO_EMPLEADO_EMAIL", EMAIL_POR_DEFECTO)
const nombre = leerVariable("CAMARERO_EMPLEADO_NOMBRE", NOMBRE_POR_DEFECTO)
const admin = parametrosDesdeUrl(url, await leerAutoridadCertificadora(), contrasena)

const cliente = await conectar(admin)
try {
  const resultado = await cliente.query(SENTENCIA, [email, nombre])
  const filas = resultado.rowCount ?? -1
  process.stdout.write(`Sentencia: ${SENTENCIA}\n`)
  process.stdout.write(`Correo: ${email}\n`)
  process.stdout.write(`Nombre: ${nombre}\n`)
  process.stdout.write(`Filas actualizadas: ${filas}\n`)
  if (filas !== 1) {
    throw new Error(
      `Se esperaba actualizar exactamente 1 ficha y se actualizaron ${filas}: revisa el correo`,
    )
  }
} finally {
  await cerrar(cliente)
}
