---
id: D-027
type: decision
title: "Retencion minima: solo la que exija la ley"
status: accepted
date: 2026-09-27
tags: [privacidad, legal]
related: []
---

## Decision

La retención de datos es la mínima que exija la ley. Los identificadores técnicos se purgan:
las sesiones de mesa se destruyen al cerrar la mesa, las IP viven hasheadas con salt
rotatorio 24 horas y los pedidos se conservan 90 días y luego se agregan.

## Justificacion

Reduce el riesgo y el volumen de datos personales tratados, en línea con la Ley 21.719. La
purga de identificadores técnicos es la mitigación concreta de este principio.

## Alternativas

- **Retención indefinida:** descartada por riesgo y por innecesaria.
- **Retención larga por analítica:** descartada porque la analítica usa agregados, no datos
  personales.
- **Sin purga automática:** descartada porque deja identificadores técnicos acumulados.
