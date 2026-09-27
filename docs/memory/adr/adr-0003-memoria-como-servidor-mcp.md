---
id: ADR-0003
type: adr
title: "La memoria vive en markdown versionado y el MCP es guardian, no almacen"
status: accepted
date: 2026-09-27
tags: [memoria, mcp, arquitectura]
related: []
---

## Contexto

En la fase de planificacion se acumularon decenas de decisiones: sin pagos en la app, el
comensal es anonimo, Cloudflare en lugar de Vercel, dinero entero, emparejamiento con
aprobacion humana. Sin un sitio unico donde vivan, en pocas semanas cada agente propone
cosas incompatibles con lo ya decidido y el proyecto se desvia en silencio. Ademas, la
memoria no puede quedar encerrada en una herramienta opaca ni en el prompt de un agente,
porque ahi se pierde o no se revisa.

## Decision

La **fuente de verdad** de la memoria son ficheros markdown versionados en git dentro de
`docs/memory`. El servidor MCP `camarero-memory` es el **guardian y el indice**: carga los
ficheros, los valida contra un esquema, responde consultas y bloquea las escrituras que
rompen las reglas. No es un almacen: no hay base de datos ni indice persistente; el indice
se reconstruye en memoria en cada arranque.

## Alternativas consideradas

- **Base de datos como fuente de verdad:** descartada porque es opaca, no se revisa en un
  pull request y complica la recuperacion ante corrupcion.
- **Documentacion dentro del prompt o de `AGENTS.md`:** descartada porque se pierde, no
  tiene historial y no se puede validar.
- **Wiki o herramienta externa (tipo Notion):** descartada por quedar fuera del repositorio
  y de git, y por depender de un servicio de terceros.
- **Un unico documento gigante:** descartado porque impide referencias entre documentos y
  hace ilegible el historial de cambios.

## Consecuencias

- La memoria es legible por humanos y diffeable en cada cambio.
- El historial de git es la garantia de que nada se reescribe en silencio.
- Sin indice persistente: si algo se corrompe, se borra y se regenera.
- Toda escritura pasa por el validador y la guarda de secretos del MCP.
