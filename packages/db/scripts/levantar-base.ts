/**
 * Ciclo de vida del contenedor efimero de PostgreSQL.
 *
 * Un contenedor por ejecucion con nombre unico, publicado en un puerto distinto del
 * 5432 nativo, y eliminado siempre al terminar (RISK-015). Ninguna operacion depende
 * de que los tests hayan ido bien.
 */
import { execFileSync } from "node:child_process"
import type { ParametrosConexion } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import { IMAGEN_POSTGRES } from "../src/configuracion.ts"

const contenedoresYaDetenidos = new Set<string>()

export function comprobarDemonioDocker(): void {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" })
  } catch (causa) {
    // En Windows el fallo real es un npipe que no existe; se traduce a una accion clara.
    throw new Error("Docker Desktop no esta corriendo. Arrancalo y vuelve a intentarlo.", {
      cause: causa,
    })
  }
}

export function nombreDeContenedorUnico(): string {
  return `camarero-db-test-${process.pid}-${Date.now()}`
}

export function arrancarContenedor(
  nombre: string,
  puerto: number,
  admin: ParametrosConexion,
): void {
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      nombre,
      "--env",
      `POSTGRES_USER=${admin.user}`,
      "--env",
      `POSTGRES_PASSWORD=${admin.password}`,
      "--env",
      `POSTGRES_DB=${admin.database}`,
      "--publish",
      `127.0.0.1:${puerto}:5432`,
      IMAGEN_POSTGRES,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  )
}

export function detenerContenedor(nombre: string): void {
  // Idempotente: lo llaman tanto el `afterAll` como los manejadores de senales.
  if (contenedoresYaDetenidos.has(nombre)) {
    return
  }
  contenedoresYaDetenidos.add(nombre)
  try {
    execFileSync("docker", ["rm", "--force", nombre], { stdio: "ignore" })
  } catch (error) {
    process.stderr.write(`Aviso: no se pudo eliminar el contenedor ${nombre}: ${String(error)}\n`)
  }
}

export function contenedoresConNombre(nombre: string): string[] {
  const salida = execFileSync(
    "docker",
    ["ps", "--all", "--filter", `name=^${nombre}$`, "--format", "{{.Names}}"],
    { encoding: "utf8" },
  )
  return salida
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
}

export async function esperarBaseLista(
  parametros: ParametrosConexion,
  timeoutMs = 90_000,
): Promise<void> {
  const limite = Date.now() + timeoutMs
  let ultimoError: unknown
  while (Date.now() < limite) {
    try {
      const cliente = await conectar(parametros)
      await cerrar(cliente)
      return
    } catch (error) {
      ultimoError = error
      await new Promise<void>((resolver) => {
        setTimeout(resolver, 500)
      })
    }
  }
  throw new Error(`La base de pruebas no respondio en ${timeoutMs} ms.`, { cause: ultimoError })
}
