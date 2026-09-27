---
id: ADR-0008
type: adr
title: Los importes se derivan en un disparador BEFORE sobre la propia fila, nunca con UPDATE desde funciones
status: accepted
date: 2026-09-27
tags:
  - dinero
  - rls
  - postgres
  - integridad
related:
  - CONTRACT-dinero
  - D-037
  - LL-007
  - LL-004
---

## Contexto

Un verificador demostro con psql que un comensal podia insertar una linea de comanda con unit_price_clp = 1 cuando el plato valia 10000, y una comanda con subtotal y total a cero. La RLS aislaba bien entre organizaciones pero no protegia la regla central del producto: el precio nunca viene del cliente. Un primer intento de arreglo con funciones SECURITY DEFINER que hacian UPDATE sobre otras tablas fracaso por la interaccion con FORCE ROW LEVEL SECURITY.

## Decision

El precio y el nombre de una linea de comanda se calculan en un disparador BEFORE INSERT sobre order_items, que lee menu_items y modifier_options y asigna los valores a la propia fila antes de escribirla. La funcion del disparador es SECURITY DEFINER y solo puede tocar la fila que ya se esta escribiendo: nunca hace UPDATE sobre otra tabla. Los totales de la comanda se derivan de sus lineas al insertar o actualizar la comanda, tambien en un BEFORE sobre la propia fila.

## Alternativas consideradas

(A) Recalcular los importes con funciones SECURITY DEFINER que hacen UPDATE sobre orders y order_items. Es lo que intente y FALLO: con FORCE ROW LEVEL SECURITY, el definer queda sujeto a las politicas del llamante, su UPDATE afecta a 0 filas y el recalculo se descarta en silencio. Ademas el definer no puede leer menu_items al sembrar, y provoca recursion cuando la politica de una tabla la consulta a si misma. (B) Calcular los totales en el borde (Cloudflare Worker) y guardarlos. Descartada: deja la integridad del dinero fuera de la base de datos, que es donde debe ser innegociable, y un borde comprometido o mal escrito vuelve a permitir el fraude. (C) Trigger BEFORE que solo lee la carta y asigna columnas de la propia fila. Elegida.

## Consecuencias

Ganamos: la base de datos misma garantiza que el precio y el nombre de una linea son los de la carta, aunque el borde tenga un fallo o alguien llame a la API a mano. No hay ningun camino, ni siquiera con `camarero_app`, para insertar una linea con un precio inventado. Perdemos: hay que ser disciplinado con la regla de que ningun trigger toque mas de una fila, y los totales de la comanda no se recalculan solos cuando cambia una linea: se recalculan al insertar o modificar la comanda a partir de sus lineas, asi que el flujo debe respetar el orden (primero las lineas, despues cerrar la comanda). Ademas el precio se congela al insertar la linea: si el local cambia el precio entre que el comensal abre la carta y confirma, se cobra el precio nuevo, no el que vio. Eso es deliberado y hay que decirlo en la UI.
