---
id: D-012
type: decision
title: "Cupones, promociones y descuentos configurables por local"
status: accepted
date: 2026-09-27
tags: [producto, negocio]
related: []
---

## Decision

Cada local puede configurar cupones, promociones y descuentos (porcentaje, importe fijo o
producto gratis), con código opcional, subtotal mínimo, tope de descuento, vigencia y
máximo de usos.

## Justificacion

Aporta mínima fricción y se adapta a cada establecimiento, que es quien decide su política
comercial. La validación y el recuento de usos se hacen siempre en el servidor.

## Alternativas

- **Promociones fijas y globales:** descartadas porque no se adaptan a cada local.
- **Sin descuentos en v1:** descartado porque es una función esperada por los locales.
- **Fidelización con identificación:** descartada por incompatibilidad con el anonimato
  (ver D-015).
