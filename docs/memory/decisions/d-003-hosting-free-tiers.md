---
id: D-003
type: decision
title: "Hosting en cloud gestionado sobre free tiers"
status: accepted
date: 2026-09-27
tags: [infraestructura, negocio]
related: []
---

## Decision

El hosting es cloud gestionado y usa exclusivamente free tiers de proveedores que admitan
uso comercial. En concreto: Cloudflare Pages, Workers y R2, con Supabase Free para datos.

## Justificacion

El presupuesto de operación es cero, así que solo son admisibles planes gratuitos. Además,
Cloudflare no restringe el plan gratuito al uso no lucrativo, a diferencia de otras
alternativas. Ver la sección 2 del PLAN.

## Alternativas

- **Vercel Hobby:** descartado porque sus términos excluyen el uso comercial (riesgo de
  suspensión). Ver ADR-0002.
- **VPS o servidor propio:** descartado por coste mensual y carga de mantenimiento.
- **Planes de pago de proveedores gestionados:** descartados hasta que existan ingresos.
