import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Arrancar Docker y esperar a que PostgreSQL acepte conexiones tarda mas que un
    // test normal: se da margen amplio sin recurrir a esperas fijas dentro del codigo.
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
})
