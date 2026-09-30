/**
 * Traducción del código de rol a una palabra que entienda un hostelero.
 *
 * Este es el ÚNICO sitio donde vive la traducción: la pantalla nunca muestra el código interno
 * (`org_owner`, `server`...) porque no significa nada para quien regenta el local (D-043). Los
 * seis códigos son exactamente los del `check` de `0003_personal_y_roles.sql`; si la migración
 * cambia, esta tabla cambia con ella. Para el vocabulario se sigue la tabla de `CONTRACT-pantallas`
 * («Dueno», «encargado») y el comentario de la 0003 para `no_pin`. `server` se rotula «Garzón»,
 * el término chileno que ya usan la descripción del proyecto y `TASK-F1-02`.
 */

const NOMBRES_DE_ROL: Readonly<Record<string, string>> = {
  platform_admin: "Administración de plataforma",
  org_owner: "Dueño",
  location_manager: "Encargado",
  server: "Garzón",
  kitchen: "Cocina",
  no_pin: "Tablet compartida",
}

/** Texto para un rol que no está en el `check`: sensato, nunca vacío ni un fallo. */
export const ROL_DESCONOCIDO = "Rol no reconocido"

/** Traduce el código de rol a la palabra que se muestra al usuario. */
export function nombreDeRol(rol: string): string {
  return NOMBRES_DE_ROL[rol] ?? ROL_DESCONOCIDO
}
