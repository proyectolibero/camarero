/**
 * Quien puede gestionar que, segun el rol.
 *
 * Estas funciones SOLO deciden que se dibuja en la pantalla (mostrar el formulario o no).
 * NO son la cerradura: la cerradura es la RLS de Postgres, que decide que filas se leen y
 * que escrituras se aceptan. Aqui se replican los mismos predicados que ya usan las
 * politicas (`locations_update` y `puede_gestionar()`) para que la pantalla no prometa lo
 * que la base no va a conceder. Si alguien fuerza la peticion por POST, la RLS lo rechaza.
 */
import type { Empleado } from "../base.ts"

/**
 * Ajustes del local. La politica `locations_update` solo deja escribir a la plataforma y al
 * dueno de la organizacion; el encargado puede ver el local pero no renombrarlo ni cambiar
 * su estado.
 */
export function puedeEditarLocal(empleado: Empleado): boolean {
  return empleado.rol === "org_owner" || empleado.rol === "platform_admin"
}

/** Plano del local (zonas y mesas): al dueno se le anade el encargado, como `puede_gestionar`. */
export function puedeGestionarPlano(empleado: Empleado): boolean {
  return puedeEditarLocal(empleado) || empleado.rol === "location_manager"
}
