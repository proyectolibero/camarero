---
id: ADR-0004
type: adr
title: "SDK de MCP v1 por compatibilidad, con el protocolo aislado en un fichero"
status: accepted
date: 2026-09-27
tags: [memoria, mcp, dependencias]
related: []
---

## Contexto

El servidor de memoria habla con el host de agentes (opencode) mediante el Model Context
Protocol. El SDK oficial de MCP evoluciona rapido: la version mayor v2 puede introducir
cambios incompatibles, y no se puede arriesgar que la memoria deje de cargar porque el
host espera v1.

## Decision

Usar el SDK de MCP en su version mayor **v1** por compatibilidad con el host, y aislar todo
el uso del protocolo en un unico fichero, `src/server.ts`. Migrar a v2 debe ser cambiar ese
fichero, sin tocar la logica de almacen, validacion ni escritura.

## Alternativas consideradas

- **SDK de MCP v2:** descartada por posible incompatibilidad con el host actual; no se
  asume el riesgo en la fase de cimientos.
- **Implementar el protocolo a mano:** descartada porque reimplementar el transporte y el
  ciclo de vida de herramientas es coste puro sin valor para el proyecto.
- **API HTTP propia en lugar de MCP:** descartada porque rompe la integracion con el host
  de agentes y obliga a mantener un cliente aparte.

## Consecuencias

- El acoplamiento al SDK queda confinado en `src/server.ts`.
- Fijar la version mayor evita sorpresas de actualizacion; actualizar sera una decision
  explicita con su propio ADR.
- La logica de negocio del proyecto no depende del protocolo y se puede probar sin arrancar
  un servidor MCP.
