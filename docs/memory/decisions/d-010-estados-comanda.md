---
id: D-010
type: decision
title: "Estados de la comanda"
status: accepted
date: 2026-09-27
tags: [producto, tecnico]
related: []
---

## Decision

Los estados de una comanda son `pendiente → aceptada → preparando → lista → servida →
cerrada`, más el estado terminal `anulada`. No se retrocede y cada transición queda
registrada en el audit log.

## Justificacion

Se confirma una máquina de estados explícita que refleja el flujo real de cocina y sala, y
que el comensal puede ver en vivo. Las transiciones permitidas están en
`domain/order-state.ts`.

## Alternativas

- **Estados libres o editables por texto:** descartados por ambigüedad y por romper la
  trazabilidad.
- **Menos estados (pendiente/listo/entregado):** descartado porque no distingue preparación
  de servicio.
- **Permitir retrocesos:** descartado porque complica la auditoría y confunde al comensal.
