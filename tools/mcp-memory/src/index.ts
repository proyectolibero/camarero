#!/usr/bin/env node
/**
 * Arranque del servidor MCP de memoria del Proyecto Camarero.
 *
 * Transporte stdio. Regla critica: stdout es el canal del protocolo.
 * Ningun log, aviso ni error puede escribirse en stdout: todo va a stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ensureMemoryRootExists, memoryRoot } from "./core/paths.ts"
import { createServer, SERVER_INFO } from "./server.ts"

async function main(): Promise<void> {
  ensureMemoryRootExists()
  const server = createServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)
  process.stderr.write(
    `[${SERVER_INFO.name} v${SERVER_INFO.version}] escuchando. Memoria: ${memoryRoot()}\n`,
  )
}

main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[camarero-memory] no pudo arrancar: ${detail}\n`)
  process.exitCode = 1
})
