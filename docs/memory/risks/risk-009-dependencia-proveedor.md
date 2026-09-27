---
id: RISK-009
type: risk
title: "Dependencia de un proveedor unico"
status: open
date: 2026-09-27
tags: [infraestructura]
likelihood: media
impact: medio
---

## Riesgo

El sistema depende de proveedores concretos (Cloudflare y Supabase). Un cambio de
condiciones, una subida de precios o una caída prolongada afectarían al servicio completo.

## Evaluacion

- Probabilidad: media
- Impacto: medio

## Mitigacion

La capa de datos es Postgres estándar: migrar a Neon o Railway es un `pg_dump`.
