---
id: D-059
type: decision
title: Los avisos del comensal viven en una tabla propia (table_notices), no dentro de pairing_requests
status: accepted
date: 2026-10-02
phase: F1
tags:
  - comensal
  - avisos
  - rls
  - fase-1
related:
  - TASK-F1-13
  - ADR-0035
  - CONTRACT-protocolo-mesa
---

## Decision

La llamada al empleado y el aviso de limpieza se guardan en una tabla nueva, table_notices, con su propio ciclo (pendiente/atendida), su caducidad y un indice unico parcial que impone una viva de cada tipo por mesa.

## Justificacion

Un aviso no es una solicitud de acceso: no comparte la maquina de estados de pairing_requests (pending/approved/rejected/expired) ni su ventana de emparejamiento. Reutilizar esa tabla habria obligado a ensuciar su check y a que dos conceptos distintos convivieran en la misma fila. Con tabla propia, el tope de una viva por tipo por mesa se expresa como un indice unico PARCIAL (where state='pendiente'), que es cerradura de base y no de pantalla: un intento de inundar el local falla con 23505 y se traduce a «ya pedido». Ademas las politicas de table_notices siguen el mismo patron de cerraduras del comensal (sesion + mesa + localidad atadas), sin abrir ningun camino entre locales.

## Alternativas

1) Reutilizar pairing_requests con un campo `kind` y ampliar su check: descartado porque mezcla dos ciclos de vida y dos conceptos (acceso a mesa vs servicio), y amplia la ventana de emparejamiento a casos que no son suyos. 2) Guardar los avisos en `orders` como comandas de tipo aviso: descartado porque un aviso no tiene lineas, ni puesto, ni precio, ni estado de preparacion; ensuciaria el KDS y los importes. 3) No persistirlos y usar solo un aviso en memoria o push: descartado porque la pantalla del personal tiene que listarlos con su antiguedad, atenderlos y que caduquen solos, y eso exige fila con estado. 4) Una tabla nueva por tipo (llamadas y limpieza aparte): descartado porque duplica politicas, indices y codigo para dos avisos que se comportan igual.
