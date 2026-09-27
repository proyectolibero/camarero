---
id: LL-009
type: lesson
title: Diagnostique el sintoma y no el mecanismo, y propuse un rediseno tres veces mas grande
status: recorded
date: 2026-09-27
tags:
  - diagnostico
  - rls
  - arquitectura
  - causa-raiz
related: []
---

## Error

Propuse un rediseno de 23 tablas y 35 columnas nuevas basandome en un diagnostico equivocado. El problema real era mucho mas estrecho y se podia haber aislado en minutos leyendo la cadena de recursion del primer fallo. El coste: tres intentos fallidos, una suite rota y un rediseno sobredimensionado a punto de aprobarse.

## Causa raiz

Se diagnostico el problema como "el alcance no puede resolverse leyendo otras tablas" cuando el problema real era "una politica no puede leer su propia tabla". La diferencia parecia cosmetica y no lo es: llevo a proponer desnormalizar 23 tablas, lo que era mas costoso, no resolvia el caso del comensal anonimo y no atacaba la causa. El error se sostuvo tres intentos porque cada parche se validaba contra el sintoma (la suite en rojo) y no contra el mecanismo (que cadena de politicas se cierra sobre si misma).

## Prevencion

Antes de redisenar por un sintoma, aislar el mecanismo exacto del fallo con una prueba minima. En este caso bastaba con leer la cadena del stack: si se hubiera hecho desde el primer fallo, se habria visto que el ciclo terminaba en locations y no en leer otra tabla. Regla practica: cuando algo falla de forma repetida tras varios arreglos, el siguiente paso no es otro arreglo, es un experimento que aislOe la causa. Y cuando la regla de diseno sea "nunca X", comprobar que X es realmente lo que falla.

## Detalle

El ADR-0009 proponia desnormalizar org_id y location_id en 20-23 tablas para que ninguna politica RLS contuviera subconsultas. Un analisis empirico sobre las 28 tablas reales demostro que el diagnostico era erroneo: (1) la desnormalizacion no resuelve al comensal anonimo, porque dos comensales del mismo local comparten organizacion y local, y lo que los distingue es la sesion, columna que la propuesta no contemplaba; (2) una funcion SECURITY DEFINER que lee table_sessions desde la politica de menu_items funciona sin recursion, probado en un contenedor real: el comensal ve la carta de su local y no ve la de otro. Las tres recursiones tenian la misma causa y era mas estrecha: locations leyendose a si misma, directa o transitivamente. La regla correcta es "cero ciclos", no "cero subconsultas". Corregido en ADR-0010.
