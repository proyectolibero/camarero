---
id: D-037
type: decision
title: Semantica de subtotal y total en la comanda
status: accepted
date: 2026-09-27
phase: F0
tags:
  - dinero
  - comanda
  - ambiguedad-resuelta
related:
  - CONTRACT-dinero
  - CONTRACT-modelo-datos
---

## Decision

En `orders`, `subtotal_clp` es el bruto de las lineas (sin descuentos ni propina) y `total_clp` es lo que se cobra tras aplicar promociones. La comanda no lleva propina: esa vive en `bill_requests`, que es quien la solicita. El criterio final es: `total_clp = subtotal_clp - discount_clp`, con ambos terminos siempre no negativos y `discount_clp <= subtotal_clp`.

## Justificacion

Hay que fijarlo ahora porque la siguiente tarea calcula la RLS y la siguiente a esa implementa el dinero en `packages/domain`. Dejar la semantica ambigua garantiza que la funcion de totales y el esquema discrepen, y un error de importe en la cuenta es un conflicto con un cliente real. La propina no puede estar en `orders` porque una comanda no sabe si la mesa va a dividir la cuenta ni cuanto va a dejar; se decide al pedirla, en `bill_requests`.

## Alternativas

(A) `subtotal = bruto` y `total = subtotal - descuento`. Coincide con el uso habitual en un TPV y con lo que un dueno de local espera ver. Descartada como fuente unica porque CONTRACT-dinero ya define subtotal como bruto menos descuento, y ese contrato gobierna el reparto de la cuenta que es la parte de 100 % de cobertura. (B) Renombrar las columnas de `orders` a `bruto_clp` y `total_clp`. Es la opcion mas clara, pero implica una migracion nueva y el esquema acaba de quedar verificado. (C) Dejar el check conservador que acepta las dos lecturas. Es lo que hay hoy: no rechaza datos validos, pero tampoco documenta la semantica.
