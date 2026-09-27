---
id: RISK-008
type: risk
title: "Cupon de descuento filtrado"
status: open
date: 2026-09-27
tags: [seguridad]
likelihood: media
impact: bajo
---

## Riesgo

Un cupón de descuento se filtra y se usa más veces de las previstas. El local asume
descuentos no deseados y el mecanismo pierde valor.

## Evaluacion

- Probabilidad: media
- Impacto: bajo

## Mitigacion

Validación server-side, `max_uses` atómico, auditado.
