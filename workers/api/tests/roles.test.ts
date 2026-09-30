/**
 * Traducción de los roles a palabras.
 *
 * La tabla de `workers/api/src/panel/roles.ts` es el único sitio donde vive la traducción y
 * esta prueba la ata a los seis valores del `check` de `0003_personal_y_roles.sql` y al caso
 * de un rol desconocido, que debe mostrar algo sensato y no un hueco ni un fallo.
 */
import { describe, expect, it } from "vitest"
import { nombreDeRol, ROL_DESCONOCIDO } from "../src/panel/roles.ts"

describe("Panel: rótulos de rol", () => {
  it("debe traducir los seis valores del check de 0003", () => {
    expect(nombreDeRol("platform_admin")).toBe("Administración de plataforma")
    expect(nombreDeRol("org_owner")).toBe("Dueño")
    expect(nombreDeRol("location_manager")).toBe("Encargado")
    expect(nombreDeRol("server")).toBe("Garzón")
    expect(nombreDeRol("kitchen")).toBe("Cocina")
    expect(nombreDeRol("no_pin")).toBe("Tablet compartida")
  })

  it("debe devolver un texto sensato cuando el rol es desconocido, nunca un hueco", () => {
    expect(nombreDeRol("rol_que_no_existe")).toBe(ROL_DESCONOCIDO)
    expect(ROL_DESCONOCIDO.length).toBeGreaterThan(0)
  })
})
