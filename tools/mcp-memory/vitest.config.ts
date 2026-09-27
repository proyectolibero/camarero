import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Los tests trabajan sobre un arbol de memoria temporal: nunca tocan docs/memory real.
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
})
