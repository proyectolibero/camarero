---
id: RISK-002
type: risk
title: "Limite de 500 MB de base de datos en modo solo lectura"
status: open
date: 2026-09-27
tags: [infraestructura]
likelihood: baja
impact: alto
---

## Riesgo

La base de datos de Supabase Free se vuelve de solo lectura al superar los 500 MB. Si
ocurre, se dejan de registrar comandas y pedidos aunque el resto del sistema siga vivo.

## Evaluacion

- Probabilidad: baja
- Impacto: alto

## Mitigacion

Alertas al 70 %; purga de `audit_log` antiguo; fotos fuera (R2).
