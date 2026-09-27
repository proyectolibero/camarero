---
id: RISK-001
type: risk
title: "Supabase Free se pausa por inactividad"
status: open
date: 2026-09-27
tags: [infraestructura]
likelihood: media
impact: alto
---

## Riesgo

El proyecto de Supabase Free se pausa tras 7 días de inactividad. Si ocurre, la base de
datos deja de responder y el servicio queda caído hasta que alguien lo reactive a mano.

## Evaluacion

- Probabilidad: media
- Impacto: alto

## Mitigacion

Keep-alive diario; alerta antes de pausar.
