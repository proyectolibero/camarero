---
id: ADR-0010
type: adr
title: La regla de las politicas es cero ciclos, no cero subconsultas
status: proposed
date: 2026-09-27
tags:
  - rls
  - postgres
  - aislamiento
  - arquitectura
related:
  - ADR-0009
  - RISK-016
  - LL-004
  - CONTRACT-protocolo-mesa
---

## Contexto

El ADR-0009 propuso desnormalizar org_id y location_id en todas las tablas para que ninguna politica necesitara subconsultas. Un analisis de viabilidad sobre las 28 tablas reales, con pruebas ejecutadas en Postgres, demostró dos cosas: (1) la desnormalizacion no resuelve el caso del comensal anonimo, porque dos comensales del mismo local comparten organizacion y local, y lo que los distingue es la sesion; (2) el diagnostico original era erroneo: una funcion SECURITY DEFINER que lee table_sessions desde la politica de menu_items funciona sin recursion, como demuestra la prueba. La recursion de los tres intentos no vino de leer otra tabla, sino de un ciclo que volvia a la misma tabla: locations leyendo locations.

## Decision

La regla que gobierna las politicas RLS es "cero ciclos": la politica de una tabla no puede leer esa misma tabla, ni directa ni transitivamente. Las lecturas de otras tablas por funciones SECURITY DEFINER son validas si no hay camino de vuelta, y para el comensal anonimo se aceptan como mecanismo de resolucion de contexto.

## Alternativas consideradas

(A) Desnormalizar org_id y location_id en las 20-23 tablas que no los tienen, con la regla de cero subconsultas. Es lo que proponia el ADR-0009 y el analisis demostró que es MAS FUERTE DE LO NECESARIO: obliga a tocar 23 tablas y 35 columnas, y aun asi no resuelve al comensal, porque dos comensales del mismo local comparten org_id y location_id. La clave que los distingue es session_id, que la desnormalizacion no contemplaba. (B) Pasar todo el contexto al borde, incluido el local del comensal. Es la opcion mas simple en la base, pero deja el aislamiento en manos del borde: es el patron que el proyecto rechazo para el precio. (C) Cero ciclos, con las columnas desnormalizadas solo donde el ciclo existe. Elegida, y ademas verificada experimentalmente.

## Consecuencias

Gana: se evita la clase entera de fallo con cambios quirurgicos en lugar de tocar 23 tablas. Las tres recursiones observadas desaparecen. Se acepta explicitamente que una funcion puede leer otra tabla si no hay camino de vuelta, y eso permite que el comensal anonimo siga existiendo sin que el borde le resuelva el local: la politica de menu_items puede leer la sesion para saber su local. Se conserva la propiedad que importa: el aislamiento no depende de que el borde acierte. Pierde: la regla es mas dificil de comprobar automaticamente que 'cero subconsultas', porque exige razonar sobre el grafo de dependencias. Se mitiga con un test que recorra el grafo: un test que compruebe que ninguna politica de la tabla X lee X, ni directa ni transitivamente. Sin ese test, la regla es una convencion que alguien puede romper sin darse cuenta, que es exactamente lo que ha pasado tres veces.
