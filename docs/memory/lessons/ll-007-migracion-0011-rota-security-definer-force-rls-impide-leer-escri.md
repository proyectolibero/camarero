---
id: LL-007
type: lesson
title: "Migracion 0011 rota: SECURITY DEFINER + FORCE RLS impide leer/escribir a camarero_owner"
status: recorded
date: 2026-09-27
tags:
  - rls
  - migraciones
  - seguridad-definer
  - dinero
  - testing
related: []
---

## Error

La migracion 0011_integridad_de_importes.sql rompe la suite: el sembrado de rls.test.ts falla con "El plato 04000000-0000-0000-0000-000000000001 no tiene precio en la carta" al insertar order_items con menu_item_id. Ademas, sus disparadores no cierran las pruebas 2 y 3: el delta del modificador si queda a 900, pero line_total_clp NO se recalcula a 10900 y los totales de la comanda quedan a 0 aunque la linea valga 10000.

## Causa raiz

Las funciones camarero_fijar_precio_de_linea, camarero_calcular_total_de_linea, camarero_calcular_total_de_comanda y camarero_recalcular_* son security definer y su propietario es camarero_owner, que NO tiene BYPASSRLS. Como todas las tablas llevan FORCE ROW LEVEL SECURITY, esas funciones quedan sujetas a las politicas RLS con el contexto del llamante, no con un contexto de servicio. Consecuencias: (1) al sembrar como admin (superusuario) no hay app.* de contexto, el select sobre menu_items dentro del definer devuelve 0 filas y el trigger lanza excepcion; (2) en el camino del comensal, el update de los totales que hace el definer choca con la politica orders_update (puede_operar es falso para el comensal), afecta a 0 filas y descarta silenciosamente el recalculo. El patron security definer + FORCE RLS de este proyecto exige que el definer no dependa de RLS para leer ni escribir; ni 0009 ni 0010 lo advierten.

## Prevencion

Antes de confiar en un trigger o funcion SECURITY DEFINER que lee o escribe tablas con FORCE RLS, probar explicitamente con camarero_app Y con el rol de sembrado. Para integridad derivada, la alternativa correcta es calcular los importes en un BEFORE trigger que solo lea y asigne columnas de la propia fila (como hace camarero_fijar_precio_de_linea con unit_price_clp, que si funciona), o dar al definer un contexto de servicio explicito, o no usar FORCE RLS en las tablas que el definer debe tocar. Anadir siempre un test por disparador que se ejecute como camarero_app y no como propietario.
