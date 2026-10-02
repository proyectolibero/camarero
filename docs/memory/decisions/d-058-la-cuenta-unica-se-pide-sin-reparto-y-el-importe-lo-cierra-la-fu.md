---
id: D-058
type: decision
title: La cuenta única se pide sin reparto y el importe lo cierra la función única del dominio
status: accepted
date: 2026-10-02
phase: F3
tags:
  - cuenta
  - dinero
  - dominio
  - fase-3
related:
  - CONTRACT-dinero
  - D-039
  - D-004
  - TASK-F3-01
---

## Decision

El comensal pide la cuenta con bill_requests.split_mode='none', un modo nuevo para «una cuenta para la mesa». El importe y la propina los calcula la función única de totales de packages/domain (calcularCuenta), a partir del consumo leído de la base; el formulario del panel solo manda forma de pago y porcentaje de propina, nunca un importe. La cuenta se marca cobrada por la existencia de un checkouts, sin reescribir bill_requests.state.

## Justificacion

El esquema exigía uno de los cuatro modos de reparto, y en F3 todavía no hay reparto: usar 'equal' o 'manual' habría sido mentir en el dato. Un modo 'none' explícito representa el caso real «una cuenta para la mesa» y no adelanta trabajo de los cuatro modos. El importe debe salir de la base (CONTRACT-dinero) y de una sola función, y la existencia de un cobro como hecho inmutable evita depender de una política de UPDATE que el dueño de la organización no tiene.

## Alternativas

(A) Usar split_mode='equal' con una sola cuota: descartado, falsea el dato y adelanta un modo de reparto que llega después. (B) Añadir una columna de importe al checkouts o al bill_requests y fiarla del panel: descartado, el importe saldría de un segundo cálculo y podría separarse de lo que ve el comensal. (C) Marcar bill_requests.state='settled' al cobrar: descartado porque la política bill_requests_update no admite al dueño de la organización (en_mi_org) y el humano cobra como dueño; además el cobro ya es un hecho con su propia tabla.
