---
id: D-005
type: decision
title: "No hay pagos dentro de la app"
status: accepted
date: 2026-09-27
tags: [producto, legal]
related: []
---

## Decision

La aplicación no procesa pagos. El comensal pide la cuenta y un empleado la cobra en el TPV
del local. El dinero nunca pasa por el sistema.

## Justificacion

Elimina la necesidad de pasarela de pago, los requisitos PCI, los procesos KYC y la
regulación financiera (CMF), además de toda la responsabilidad financiera. Es el cambio de
rumbo recogido en la sección 1.1 del PLAN.

## Alternativas

- **Pasarela de pago integrada (por ejemplo Mercado Pago):** descartada por responsabilidad
  financiera, PCI, KYC y regulación.
- **Cobro con tarjeta propio:** descartado por el mismo motivo y por el coste de
  cumplimiento.
- **Pago online opt-in en v1:** descartado; queda como feature futura en la que el local
  conecta su propia pasarela.
