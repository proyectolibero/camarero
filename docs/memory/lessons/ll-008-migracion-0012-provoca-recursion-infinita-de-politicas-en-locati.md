---
id: LL-008
type: lesson
title: Migracion 0012 provoca recursion infinita de politicas en locations
status: recorded
date: 2026-09-27
tags:
  - rls
  - migraciones
  - recursion
  - politicas
related: []
---

## Error

La migracion 0012_alcance_de_cobros_y_encargados.sql deja a cualquier location_manager con "ERROR: stack depth limit exceeded" en cuanto consulta locations, menu_items u orders. La prueba 5 (encargado sin local que deberia ver su organizacion) no solo no pasa: revienta la base. La prueba 4 (cobro a nombre de otro) si queda cerrada.

## Causa raiz

El nuevo en_mi_local llama a org_del_local(p_local), que hace select sobre locations. Pero locations_select llama a en_mi_local(id). Es la recursion que 0008 documenta haber roto precisamente copiando org_id en table_sessions y que 0009 evita pasando el valor de la fila como parametro: una politica de la tabla X no puede consultar X. La regla existia y 0012 la incumple.

## Prevencion

Cumplir la regla de 0009: la politica de locations no puede leer locations. Para el alcance de un encargado sin local, derivar la organizacion por columna directa en la propia politica (org_id = org_actual()) en vez de delegar en una funcion que relee la tabla. Anadir un test que ejecute una consulta a locations como location_manager con location_id nulo.
