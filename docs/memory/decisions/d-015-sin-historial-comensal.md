---
id: D-015
type: decision
title: "Sin historial ni perfiles de comensal"
status: accepted
date: 2026-09-27
tags: [producto, privacidad]
related: []
---

## Decision

No se guarda historial ni perfiles de comensal. Cada visita empieza de cero y no hay
memoria de pedidos anteriores asociada a una persona.

## Justificacion

Es la base del anonimato y de la promesa de privacidad del producto. Además hace
incompatible cualquier programa de fidelización en v1.

## Alternativas

- **Historial de pedidos por comensal:** descartado por requerir identificar a la persona.
- **Perfiles y preferencias persistentes:** descartados por el mismo motivo.
- **Fidelización por identidad:** descartada en v1; se resuelve en v2 con un código
  impreso por el local, sin identidad en la base (sección 1.1 del PLAN).
