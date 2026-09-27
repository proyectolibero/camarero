---
id: D-029
type: decision
title: "Disponibilidad objetivo del 99 % con degradacion elegante"
status: accepted
date: 2026-09-27
tags: [operacion, producto]
related: []
---

## Decision

El objetivo de disponibilidad es 99 %, asumido sin alta disponibilidad y con degradación
elegante. No se promete 99,9 %. Siempre debe existir un camino humano de ayuda.

## Justificacion

Con una sola persona y free tiers no se puede sostener alta disponibilidad. Lo que sí se
garantiza es que el comensal siempre puede pedir ayuda a un humano y que todo fallo se
traduce en una acción posible.

## Alternativas

- **Prometer 99,9 %:** descartado porque no es sostenible con un mantenedor y free tiers.
- **Alta disponibilidad con redundancia multi-región:** descartada por coste.
- **Sin objetivo declarado:** descartado porque hace imposible medir y comunicar el
  servicio.
