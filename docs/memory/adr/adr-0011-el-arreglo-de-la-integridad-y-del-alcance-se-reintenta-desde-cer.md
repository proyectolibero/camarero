---
id: ADR-0011
type: adr
title: El arreglo de la integridad y del alcance se reintenta desde cero, con el diseno cerrado antes de escribir SQL
status: accepted
date: 2026-09-27
tags:
  - proceso
  - metodo
  - fase-0
related:
  - RISK-016
  - ADR-0008
  - ADR-0010
  - TASK-F0-02
  - LL-009
---

## Contexto

La suite volvio a 123 tests en verde sacando las migraciones 0011 y 0012 del camino (RISK-016). Quedan dos cosas por cerrar antes de tocar SQL: donde se calculan los importes de una comanda, y como se resuelve el alcance de las politicas. Ambas tienen ya un diseno decidido (ADR-0008 y ADR-0010) pero sin implementar ni verificar.

## Decision

La integridad de importes y el rediseno del alcance se retoman en una tarea nueva, escribiendo migraciones desde cero contra ADR-0008 y ADR-0010, y verificando cada afirmacion con un test ejecutado antes de continuar. No se parchean las migraciones descartadas.

## Alternativas consideradas

(A) Dejar RISK-016 abierto y seguir con otra tarea. Se descarta: la integridad de importes es la regla central del producto y el esquema sin ella no es una base sobre la que construir. (B) Reintentar el arreglo inmediatamente. Se descarta: tres intentos fallidos seguidos indican que hace falta corregir el metodo antes de escribir mas SQL. (C) Cerrar el diseno primero (que ya se ha hecho con ADR-0008 y ADR-0010), reescribir las migraciones desde cero en lugar de parchear las existentes, y verificar cada afirmacion con una prueba ejecutada antes de pasar a la siguiente. Elegida.

## Consecuencias

Gana: las migraciones nuevas se escriben contra un diseno ya verificado, y cada paso lleva su prueba antes de continuar, en lugar de acumular SQL y descubrir al final que no converge. Las descartadas quedan como registro de por que el camino anterior no servia. Pierde: hay trabajo ya escrito en descartadas que no se reutiliza tal cual, y el coste de volver a escribirlo. Se acepta a cambio de no volver a parchear sobre codigo que no funciona.
