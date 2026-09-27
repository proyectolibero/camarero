---
id: D-031
type: decision
title: "Monitorizacion gratuita con Sentry y UptimeRobot o Better Stack"
status: accepted
date: 2026-09-27
tags: [operacion, infraestructura]
related: []
---

## Decision

La monitorización se cubre con herramientas gratuitas: Sentry para errores, UptimeRobot o
Better Stack para disponibilidad cada 5 minutos, y alertas de cuota y de gasto de
Cloudflare.

## Justificacion

Permite detectar fallos y consumos antes de que se conviertan en incidentes, con coste
cero. Los umbrales de alerta se definen para disponibilidad, errores, latencia y uso de
cuotas.

## Alternativas

- **Sin monitorización:** descartado porque un servicio caído pasaría inadvertido.
- **Herramientas de pago:** descartadas por presupuesto cero.
- **Monitorización propia:** descartada por ser un proyecto en sí mismo.
