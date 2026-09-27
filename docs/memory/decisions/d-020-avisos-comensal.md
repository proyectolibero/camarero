---
id: D-020
type: decision
title: "Avisos al comensal con sonido y vibracion"
status: accepted
date: 2026-09-27
tags: [producto, accesibilidad]
related: []
---

## Decision

El comensal recibe avisos del estado de su pedido mediante notificaciones con sonido y
vibración dentro de la PWA, siempre acompañadas de texto.

## Justificacion

Los avisos sensoriales hacen perceptible el cambio de estado incluso con el móvil en la
mesa, y el texto los mantiene accesibles. Se confirma como parte del contrato de producto.

## Alternativas

- **Solo aviso visual en pantalla:** descartado porque el comensal no mira el móvil de
  continuo.
- **Notificaciones push al comensal:** descartadas porque requieren permiso y datos que no
  queremos pedir.
- **Sin avisos:** descartado porque el comensal no sabría cuándo se sirve su pedido.
