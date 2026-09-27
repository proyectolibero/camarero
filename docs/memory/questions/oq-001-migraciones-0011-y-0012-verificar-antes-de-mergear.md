---
id: OQ-001
type: question
title: "Migraciones 0011 y 0012: verificar antes de mergear"
status: open
date: 2026-09-27
tags:
  - verificacion
  - "0011"
  - "0012"
  - rls
  - dinero
related: []
---

Verificacion independiente de 0011 y 0012 con PostgreSQL 17 efimero (puerto 54322) como camarero_app: prueba 1 (precio manipulado) CONFIRMADO CERRADO; prueba 4 (cobro a nombre de otro) CONFIRMADO CERRADO; prueba 6 (server sin local) CONFIRMADO CERRADO; prueba 2 (delta de modificador) delta OK 900 pero line_total_clp no recalcula y prueba 3 (totales a cero) SIGUEN ABIERTAS por SECURITY DEFINER + FORCE RLS; prueba 5 (encargado sin local) SIGUE ABIERTA por recursion infinita de politicas. La suite falla: 123 esperados -> 95 mcp + 4 db pasan, rls.test.ts no arranca (24 skipped). biome y typecheck en exit 0. Se recomienda no mergear y rehacer 0011 con la estrategia de BEFORE trigger que solo lee y asigna la propia fila, y 0012 sin releer locations desde su politica.
