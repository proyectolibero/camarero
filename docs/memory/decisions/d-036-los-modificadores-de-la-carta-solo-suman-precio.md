---
id: D-036
type: decision
title: Los modificadores de la carta solo suman precio
status: accepted
date: 2026-09-27
phase: F0
tags:
  - carta
  - dinero
  - alcance
related:
  - CONTRACT-dinero
---

## Decision

En el MVP, los modificadores solo suman. `modifier_options.price_delta_clp` mantiene la restriccion `>= 0`. Si en el futuro hace falta un modificador que reste, se modelara como descuento de linea, no como delta negativo.

## Justificacion

El caso de uso real de hosteleria para los modificadores es sumar: "extra queso", "doble carne", "sin gluten". Un modificador que reste es una promocion encubierta, y para eso ya existe `promotions`. Mantener los importes no negativos hace que el reparto de cuenta tenga una sola direccion posible y elimina una clase entera de casos borde. La restriccion es barata de relajar mas adelante con una migracion nueva; quitarla ahora y volver a ponerla seria lo caro.

## Alternativas

(A) Permitir deltas negativos: el modificador puede restar (e.g. "sin queso" -500). Es correcto para el negocio, pero abre la puerta a lineas con total negativo si se combina mal, y complica el reparto de cuenta. (B) Modelar la sustraccion como un descuento a nivel de linea en lugar de un modificador: mas limpio contablemente, pero complica el modelo ahora y no hay caso de uso confirmado. (C) Quitar la restriccion y no validar: descartada, un importe negativo silencioso es un error que aparece en la cuenta del comensal.
