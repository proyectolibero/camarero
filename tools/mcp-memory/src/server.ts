/**
 * Punto unico de acoplamiento con el SDK de MCP.
 *
 * Si algun dia se migra del SDK v1 (`@modelcontextprotocol/sdk`) al v2
 * (`@modelcontextprotocol/server` + Zod v4), este es el UNICO fichero que cambia.
 * Ver ADR-0004.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { MemoryStore } from "./core/store.ts"
import { registerReadTools } from "./tools/read.ts"
import { registerWriteTools } from "./tools/write.ts"

export const SERVER_INFO = {
  name: "camarero-memory",
  version: "0.1.0",
} as const

export interface CreateServerOptions {
  /** Raiz de la memoria. En produccion se omite y se resuelve desde el repositorio. */
  readonly root?: string
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const store = new MemoryStore(options.root)
  const server = new McpServer({ name: SERVER_INFO.name, version: SERVER_INFO.version })

  registerReadTools(server, store)
  registerWriteTools(server, store)

  return server
}
