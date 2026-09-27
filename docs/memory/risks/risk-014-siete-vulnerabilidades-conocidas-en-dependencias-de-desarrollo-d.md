---
id: RISK-014
type: risk
title: Siete vulnerabilidades conocidas en dependencias de desarrollo del MCP
status: open
date: 2026-09-27
tags:
  - dependencias
  - seed
  - fase-0
related: []
impact: alto
likelihood: alta
---

## Riesgo

El primer run de osv-scanner sobre el repositorio publico encontro 7 vulnerabilidades (1 critica, 1 alta, 5 medias) que afectan a 4 paquetes: vite@5.4.21, vitest@2.1.9, @vitest/mocker@2.1.9 y esbuild@0.21.5. Son dependencias de DESARROLLO de tools/mcp-memory: no entran en produccion, porque el MCP no se despliega a ningun sitio. El impacto real hoy es bajo, pero quedan en el inventario de dependencias y el workflow de Seguridad esta en rojo hasta que se resuelvan. Dependabot ya ha abierto el PR de vitest 2.1.9 a 5.0.1.

## Evaluacion

- Probabilidad: alta
- Impacto: alto

## Mitigacion

Actualizar vite, vitest y esbuild a versiones parcheadas (hay PR ya abierto por Dependabot). El escaner corre en push, PR y semanal, asi que la deuda no puede crecer en silencio. Cuando la deuda este saldada, anadir el check de Seguridad a la proteccion de rama para que tambien bloquee el merge.
