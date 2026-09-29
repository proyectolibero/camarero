import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // El manejador del borde es una funcion pura sobre Web API (Request/Response), que
    // Node 22 ya trae de serie. No hace falta el runtime de Workers para probarlo.
    environment: "node",
  },
})
