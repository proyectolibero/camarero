---
id: TASK-F0-01
type: task
title: Crear el repositorio y el pipeline de integracion continua
status: done
date: 2026-09-27
phase: F0
tags:
  - fase-0
  - infraestructura
related:
  - D-021
  - D-025
acceptance:
  - El repositorio es publico, con licencia AGPL y plantilla de pull request
  - El pipeline ejecuta biome, tsc --strict, vitest y osv-scanner en cada push y pull request
  - La proteccion de rama impide merge con CI en rojo
depends_on: []
doc: contracts/contract-operacion-operacion-del-repositorio-y-la-integracion-continua.md
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: true
  evidence: '2026-09-27 · pnpm biome ci . && pnpm check · exit 0 · 8 ficheros de test, 95 pasan, 0 fallan · CI en GitHub run 36342279758 success · repo publico github.com/proyectolibero/camarero (AGPL + plantilla de PR) · proteccion de rama: required_status_checks "Lint, tipos y tests" strict=true, allow_force_pushes=false, allow_deletions=false'
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

## Notas

- **2026-09-27** — Completada y verificada con pruebas ejecutadas. Documento asociado: CONTRACT-operacion. Aviso abierto: el workflow de Seguridad esta en rojo por 7 vulnerabilidades reales en dependencias de desarrollo (vite, vitest, esbuild, @vitest/mocker); Dependabot ya ha abierto PRs.
