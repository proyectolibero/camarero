---
id: ADR-0012
type: adr
title: La regla de cero ciclos se acepta y se comprueba con un test que recorre el grafo de dependencias
status: accepted
date: 2026-09-27
tags:
  - rls
  - testing
  - arquitectura
  - verificacion
related:
  - ADR-0009
  - ADR-0010
  - RISK-016
  - RISK-017
  - LL-004
---

## Contexto

El ADR-0010 fijo la regla correcta (cero ciclos) pero quedo en estado proposed porque no se sabia si era comprobable: sin comprobacion automatica, es una convencion que se rompe sin que nadie se entere, y eso ya habia ocurrido tres veces. La investigacion lo resolvio: se puede construir el grafo de dependencias de las politicas combinando pg_depend (que registra las funciones y tablas referenciadas directamente en una politica, pero no el interior de los cuerpos de funcion) con pg_proc.prosrc (que si contiene el SQL de las funciones y permite extraer que tablas lee cada una). El detector resultante se ha validado con dos controles ejecutados.

## Decision

El ADR-0010 se acepta, y la regla de cero ciclos se hace cumplir con un test permanente que recorre el grafo de dependencias de las politicas y falla si alguna tabla se alcanza a si misma. El test se ejecuta en el pipeline junto al resto de la suite de base de datos.

## Alternativas consideradas

(A) Dejar ADR-0010 como propuesta y confiar en la disciplina al escribir politicas. Descartada: es exactamente lo que fallo tres veces. (B) Adoptar la regla de cero subconsultas de ADR-0009, mas simple de comprobar por inspeccion visual. Descartada porque es mas costosa (23 tablas), no resuelve al comensal anonimo y ademas no ataca la causa real. (C) Adoptar cero ciclos Y hacerla comprobable con un test que recorre el grafo. Elegida: el analisis ha demostrado que se puede construir esa comprobacion con SQL puro, sin dependencias nuevas, y que el metodo supera los dos controles.

## Consecuencias

Gana: la regla deja de ser una convencion moral y pasa a ser una propiedad comprobada en cada ejecucion del pipeline. El test detecta los ciclos antes de que lleguen a produccion, que es donde dolian. Ademas el metodo sirve de control de calidad sobre cualquier migracion futura que toque politicas, y su coste de ejecucion es despreciable. Pierde: el detector no ve SQL dinamico ni cuerpos plpgsql con EXECUTE, ni traza el paso por vistas, y depende de que las referencias se cualifiquen con public. Es decir, cubre el 100 por cien del codigo actual pero no es un detector universal: si algun dia se escribe SQL que se arme en tiempo de ejecucion, habra que reforzarlo. Se asume conscientemente, y la limitacion queda escrita junto al test en lugar de descubrirse mas tarde.
