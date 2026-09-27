---
id: TASK-F0-01
type: task
title: "Crear el repositorio y el pipeline de integracion continua"
status: todo
date: 2026-09-27
phase: F0
tags: [fase-0, infraestructura]
related: [D-021, D-025]
acceptance:
  - "El repositorio es publico, con licencia AGPL y plantilla de pull request"
  - "El pipeline ejecuta biome, tsc --strict, vitest y osv-scanner en cada push y pull request"
  - "La proteccion de rama impide merge con CI en rojo"
depends_on: []
requires:
  tests: true
  doc: true
tests:
  suite: "pnpm test"
  passed: false
  evidence: null
doc: null
---

## Descripcion

Dejar en pie el esqueleto tecnico: monorepo pnpm con Biome, tsconfig estricto, Vitest y
Playwright, mas el pipeline de integracion continua. Es la base sobre la que se apoya todo lo
demas, y sin CI verde no se acepta ninguna tarea posterior.

Incluye: monorepo con `apps/`, `packages/`, `workers/` y `tools/`; repo publico con licencia
AGPL y plantillas de issue y pull request; politica de seguridad; y el pipeline con Biome,
`tsc --strict`, Vitest, osv-scanner y despliegue de preview.

## Aceptacion

- [ ] El repositorio es publico, con licencia AGPL y plantilla de pull request
- [ ] El pipeline ejecuta biome, tsc --strict, vitest y osv-scanner en cada push y pull request
- [ ] La proteccion de rama impide merge con CI en rojo
