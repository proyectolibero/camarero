---
id: D-011
type: decision
title: "Modificadores, notas y cantidades por plato"
status: accepted
date: 2026-09-27
tags: [producto]
related: []
---

## Decision

Cada plato admite modificadores, notas y cantidades. Los modificadores se agrupan en
grupos con mínimo, máximo y obligatoriedad, y cada opción puede tener un delta de precio.

## Justificacion

Es el comportamiento que se corresponde con una comanda real de hostelería. Se confirma en
la tabla de decisiones y se concreta en el modelo de datos de la sección 4.3 del PLAN.

## Alternativas

- **Solo platos sin personalización:** descartado porque no cubre la realidad de una carta.
- **Notas de texto libre sin modificadores estructurados:** descartado porque impide
  calcular precios correctamente.
- **Modificadores globales sin grupos:** descartado por poca expresividad y por no poder
  exigir selecciones.
