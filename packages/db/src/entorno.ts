/**
 * Punto de entrada unico del runner de base de datos de pruebas.
 *
 * Levanta el contenedor, prepara los roles, aplica las migraciones y devuelve el
 * entorno listo. La limpieza se registra aqui y no depende de que los tests terminen
 * bien: queda cubierta por `--rm`, por `detener()` y por los manejadores de senales.
 */

import { aplicarMigraciones } from "../scripts/aplicar-migraciones.ts"
import {
  arrancarContenedor,
  comprobarDemonioDocker,
  detenerContenedor,
  esperarBaseLista,
  nombreDeContenedorUnico,
} from "../scripts/levantar-base.ts"
import {
  concederPermisosDeAplicacion,
  prepararRolDeAplicacion,
  prepararRoles,
} from "../scripts/preparar-roles.ts"
import { cadenaDeConexion } from "./conexion.ts"
import type { ParametrosDePrueba } from "./configuracion.ts"
import { modoDeBase, parametrosDePrueba, puertoDePrueba } from "./configuracion.ts"

export type EntornoDePruebas = {
  nombreDelContenedor: string
  cadenaApp: string
  parametros: ParametrosDePrueba
  detener: () => void
}

/**
 * Opciones del entorno de pruebas. `directorioMigraciones` solo lo usa una prueba: la que
 * quiere levantar el esquema HASTA una migracion concreta, sembrar datos con el modelo viejo
 * y luego aplicar la migracion nueva para comparar recuentos.
 */
export type OpcionesDeEntorno = {
  readonly directorioMigraciones?: string
}

function registrarLimpiezaPorSenales(nombre: string): void {
  process.once("exit", () => {
    detenerContenedor(nombre)
  })
  process.once("SIGINT", () => {
    detenerContenedor(nombre)
    process.exit(130)
  })
  process.once("SIGTERM", () => {
    detenerContenedor(nombre)
    process.exit(143)
  })
}

async function prepararEsquema(
  parametros: ParametrosDePrueba,
  directorio: string | undefined,
): Promise<void> {
  if (modoDeBase() === "local") {
    // Se crean los tres roles y el esquema publico pasa a ser del dueno, que no tiene
    // BYPASSRLS: asi el FORCE ROW LEVEL SECURITY tambien le obliga a el (LL-004).
    await prepararRoles(parametros.admin, parametros.owner, parametros.app)
    await aplicarMigraciones(parametros.owner, directorio)
    await concederPermisosDeAplicacion(parametros.owner, parametros.app)
    return
  }
  // Modo gestionado: el administrador ya existe (hace de postgres) y no se crea dueno del
  // esquema. Sirve para comprobar que el mismo esquema se aplica en un Postgres gestionado.
  await prepararRolDeAplicacion(parametros.admin, parametros.app)
  await aplicarMigraciones(parametros.admin, directorio)
  await concederPermisosDeAplicacion(parametros.admin, parametros.app)
}

export async function levantarEntornoDePruebas(
  opciones: OpcionesDeEntorno = {},
): Promise<EntornoDePruebas> {
  comprobarDemonioDocker()
  const nombre = nombreDeContenedorUnico()
  const parametros = parametrosDePrueba()
  arrancarContenedor(nombre, puertoDePrueba(), parametros.admin)
  try {
    await esperarBaseLista(parametros.admin)
    await prepararEsquema(parametros, opciones.directorioMigraciones)
  } catch (error) {
    // Si algo falla a mitad, no se deja el contenedor vivo esperando a nadie.
    detenerContenedor(nombre)
    throw error
  }
  registrarLimpiezaPorSenales(nombre)
  return {
    nombreDelContenedor: nombre,
    cadenaApp: cadenaDeConexion(parametros.app),
    parametros,
    detener: () => detenerContenedor(nombre),
  }
}
