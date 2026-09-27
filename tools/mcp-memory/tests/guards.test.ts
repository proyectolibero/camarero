import { describe, expect, it } from "vitest"
import {
  assertNoSecrets,
  assertSizeWithinLimit,
  ContentTooLargeError,
  MAX_CONTENT_BYTES,
  SecretDetectedError,
  scanContent,
} from "../src/core/guards.ts"

const rules = (text: string): string[] => scanContent(text).map((finding) => finding.rule)

describe("scanContent: secretos que deben bloquear", () => {
  it("detecta una clave de AWS", () => {
    expect(rules("key = AKIAIOSFODNN7EXAMPLE")).toContain("aws-access-key")
  })

  it("detecta un token de GitHub", () => {
    expect(rules("token: ghp_012345678901234567890123456789012345")).toContain("github-token")
  })

  it("detecta una clave tipo OpenAI", () => {
    expect(rules("OPENAI=sk-proj-abcdefghijklmnopqrstuvwx")).toContain("openai-key")
  })

  it("detecta un JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop"
    expect(rules(`Authorization: ${jwt}`)).toContain("jwt")
  })

  it("detecta una clave privada PEM", () => {
    expect(rules("-----BEGIN RSA PRIVATE KEY-----\nMIIE...")).toContain("private-key")
  })

  it("detecta una cadena de conexion con credenciales", () => {
    expect(rules("postgres://usuario:contrasena@db.host:5432/app")).toContain("connection-string")
  })

  it("detecta un secreto asignado", () => {
    expect(rules("password: super-secreta-123")).toContain("assigned-secret")
    expect(rules("api_key = abcdef1234567890")).toContain("assigned-secret")
  })

  it("detecta una cabecera Bearer con token literal", () => {
    expect(rules("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc")).toContain("bearer-token")
  })

  it("no confunde una constante de codigo con un secreto", () => {
    expect(rules("const passwordField = 'password';")).not.toContain("assigned-secret")
  })
})

describe("scanContent: enmascarado y severidad", () => {
  it("nunca devuelve el valor completo", () => {
    const secret = "ghp_012345678901234567890123456789012345"
    const [finding] = scanContent(`token: ${secret}`)
    expect(finding).toBeDefined()
    expect(finding?.masked).not.toBe(secret)
    expect(finding?.masked.startsWith("ghp_")).toBe(true)
    expect(finding?.masked).toContain("*")
  })

  it("marca los secretos como bloqueantes", () => {
    const finding = scanContent("key = AKIAIOSFODNN7EXAMPLE")[0]
    expect(finding?.severity).toBe("block")
  })

  it("marca el correo como aviso, no como bloqueo", () => {
    const findings = scanContent("Contacto: alguien@dominio-externo.com")
    const email = findings.find((finding) => finding.rule === "email")
    expect(email?.severity).toBe("warn")
  })

  it("no avisa por los correos del propio proyecto", () => {
    expect(rules("Contacto: soporte@proyectolibero.org")).not.toContain("email")
    expect(rules("Ejemplo: alguien@example.com")).not.toContain("email")
  })

  it("informa de la linea donde aparece", () => {
    const text = "linea uno\nlinea dos\nkey = AKIAIOSFODNN7EXAMPLE\n"
    const finding = scanContent(text).find((item) => item.rule === "aws-access-key")
    expect(finding?.line).toBe(3)
  })
})

describe("assertNoSecrets", () => {
  it("no lanza con contenido limpio", () => {
    expect(() => assertNoSecrets("Carta del local con alérgenos y precios.")).not.toThrow()
  })

  it("lanza con el detalle del hallazgo", () => {
    const error = (() => {
      try {
        assertNoSecrets("token: ghp_012345678901234567890123456789012345")
        return null
      } catch (caught) {
        return caught
      }
    })()
    expect(error).toBeInstanceOf(SecretDetectedError)
    expect((error as SecretDetectedError).findings).toHaveLength(1)
    expect((error as Error).message).toContain("linea 1")
  })
})

describe("assertSizeWithinLimit", () => {
  it("acepta un documento dentro del limite", () => {
    expect(() => assertSizeWithinLimit("x".repeat(1024))).not.toThrow()
  })

  it("rechaza un documento por encima del limite", () => {
    expect(() => assertSizeWithinLimit("x".repeat(MAX_CONTENT_BYTES + 1))).toThrow(
      ContentTooLargeError,
    )
  })
})
