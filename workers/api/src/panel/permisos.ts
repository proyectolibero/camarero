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

/**
 * La carta la escribe quien `puede_gestionar` en la base: plataforma, dueno de la organizacion
 * o encargado del local. Cocina y garzon la ven, pero no la tocan (la RLS tampoco les deja).
 */
export function puedeGestionarCarta(empleado: Empleado): boolean {
  return puedeGestionarPlano(empleado)
}

/**
 * El KDS (comandas, aceptar, anular y marcarlas listas) lo opera todo el personal del local,
 * que es exactamente lo que deja `puede_operar()` en la base: plataforma, dueno, encargado,
 * garzon, cocina y tablet compartida. Se enumeran los roles para fallar cerrado ante un rol
 * nuevo: si no esta en la lista, no opera.
 */
export function puedeOperarCocina(empleado: Empleado): boolean {
  return [
    "platform_admin",
    "org_owner",
    "location_manager",
    "server",
    "kitchen",
    "no_pin",
  ].includes(empleado.rol)
}

/**
 * Registrar el cobro de una cuenta. Replica la cerradura de la base: `checkouts_insert` admite
 * a la plataforma, al dueno de la organizacion (`en_mi_org`) y a los roles que la base llama
 * `es_cobrador` (encargado y garzon). Cocina y tablet compartida NO cobran: no tocan dinero.
 */
export function puedeRegistrarCobro(empleado: Empleado): boolean {
  return ["platform_admin", "org_owner", "location_manager", "server"].includes(empleado.rol)
}
