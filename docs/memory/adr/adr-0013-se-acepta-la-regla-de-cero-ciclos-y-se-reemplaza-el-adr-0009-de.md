---
id: ADR-0013
type: adr
title: Se acepta la regla de cero ciclos y se reemplaza el ADR-0009 de desnormalizacion masiva
status: accepted
date: 2026-09-28
tags:
  - rls
  - arquitectura
  - memoria
  - correccion
related:
  - ADR-0009
  - ADR-0010
  - ADR-0012
  - RISK-016
  - TASK-F0-06
---

## Contexto

El ADR-0010 fijo la regla correcta de alcance para las politicas RLS (cero ciclos) pero se creo en estado proposed porque en ese momento no se sabia si era comprobable. Ya lo es: el test de invariantes que recorre el grafo de dependencias esta implementado, probado como capaz de detectar ciclos reales y sinteticos, y corre en el pipeline en cada push (ADR-0012). Es decir, la decision esta tomada de hecho y verificada, pero la memoria la presenta como propuesta, mientras que el ADR-0009 (desnormalizar 23 tablas), que fue descartado por el analisis, sigue tambien como propuesta. Los dos ADR se contradicen y ninguno esta aceptado.

## Decision

Se acepta el ADR-0010: la regla de las politicas RLS es cero ciclos. El ADR-0009 queda reemplazado por este, porque la desnormalizacion masiva de columnas de alcance no resuelve el caso del comensal anonimo y no ataca la causa real.

## Alternativas consideradas

(A) Editar el ADR-0010 para cambiar su estado de proposed a accepted. Descartada: los ADR son inmutables, y la inmutabilidad es lo que permite saber que se decidio en cada momento y por que. Si se pudieran editar, la historia se reescribiria cada vez que alguien tiene una idea nueva. (B) Dejar los dos ADR como propuestas y seguir adelante. Descartada: el briefing de TASK-F0-06 los presenta ambos como aplicables, y proponen cosas contradictorias sobre el mismo problema. Un agente que lo lea no sabria que regla seguir, y la regla que SI esta implementada y verificada quedaria con menos autoridad que la que se descarto. (C) Crear un ADR nuevo que acepte explicitamente el 0010 y reemplace el 0009. Elegida.

## Consecuencias

Gana: la memoria queda coherente con el codigo. Quien lea el briefing de TASK-F0-06 vera una sola regla de alcance (cero ciclos), aceptada y comprobada por un test que corre en el pipeline. El ADR-0009 queda como registro de la propuesta que se descarto y de por que, que es informacion util. Pierde: hay tres documentos (0009, 0010 y este) para explicar algo que podria caber en uno. Es el precio de la inmutabilidad, y se paga a cambio de que la historia sea fiable.
