---
id: D-017
type: decision
title: "Plan de mesas propio con union de mesas y zonas"
status: accepted
date: 2026-09-27
tags: [producto]
related: []
---

## Decision

Cada local diseña su plan de mesas: añadir, quitar y unir (merge) mesas, además de definir
zonas como sala, barra, terraza o delivery.

## Justificacion

El diseño físico del local es libre, así que la herramienta debe permitirlo sin
restricciones rígidas. La unión de mesas se modela con vínculos entre mesas y un rol
principal o secundario.

## Alternativas

- **Plan de mesas fijo:** descartado porque ningún local encaja en una plantilla única.
- **Sin zonas:** descartado porque se pierde el filtrado del KDS y la organización por
  áreas.
- **Sin unión de mesas:** descartada porque los grupos grandes son habituales.
