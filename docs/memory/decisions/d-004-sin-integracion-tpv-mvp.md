---
id: D-004
type: decision
title: "Sin integracion con TPV en el MVP"
status: accepted
date: 2026-09-27
tags: [producto, alcance]
related: []
---

## Decision

El MVP no integra ningún TPV. El sistema se limita a registrar que un empleado cobró en la
caja del local; el cobro real ocurre en el TPV existente del establecimiento.

## Justificacion

El local ya cobra en su propia caja, de modo que integrar un TPV añadiría complejidad y
dependencias sin resolver ninguna necesidad del piloto. Mantenerlo fuera reduce el alcance
y la superficie de integración.

## Alternativas

- **Integración con TPV desde el MVP:** descartada por multiplicar el esfuerzo y depender
  de un proveedor externo por local.
- **Lista de TPVs soportados en v1:** descartada por falta de datos de mercado y de tiempo.
- **Cobro propio sin TPV:** descartada porque implicaría tocar dinero (ver D-005).
