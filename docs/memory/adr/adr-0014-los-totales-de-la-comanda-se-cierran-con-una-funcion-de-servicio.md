---
id: ADR-0014
type: adr
title: Los totales de la comanda se cierran con una funcion de servicio, no con un UPDATE del comensal
status: accepted
date: 2026-09-28
tags:
  - dinero
  - rls
  - postgres
  - arquitectura
related:
  - ADR-0008
  - ADR-0010
  - LL-007
  - CONTRACT-dinero
  - D-037
---

## Contexto

ADR-0008 fijo que los importes se derivan en un disparador BEFORE sobre la propia fila, y se acepto sin comprobar un supuesto que resulto falso: que el comensal puede actualizar su propia comanda. Una investigacion con experimentos ejecutados demostro que orders_update exige puede_operar() y que el UPDATE del comensal afecta a 0 filas, asi que el disparador no llega a ejecutarse nunca para quien hace el pedido. Se probo tambien que una funcion SECURITY DEFINER que hace UPDATE tampoco ayuda: la misma funcion afecta a 0 filas llamada por el comensal y a 1 llamada por el personal, porque el definer no salta la politica. Y se descubrio que promotions_select es solo para personal, asi que la base no puede derivar el descuento leyendo las promociones cuando quien pide es el comensal.

## Decision

El precio y el total de cada linea se derivan en un disparador BEFORE sobre order_items, con una funcion SECURITY DEFINER que SOLO lee la carta. Los totales de la comanda se cierran con una funcion dedicada que el borde invoca despues de insertar las lineas, ejecutada con un rol de servicio acotado que no se usa para ninguna otra cosa, y el descuento lo aporta codigo de confianza o es cero para el comensal: nunca lo envia quien pide.

## Alternativas consideradas

(A) Permitir que el comensal actualice su comanda, con una politica acotada y un disparador autoritativo que sobrescriba estado e idempotencia. Probado y funciona, pero el proyecto tiene UN SOLO rol de aplicacion para el borde y el comensal, asi que ese UPDATE acotado deja al comensal al alcance de columnas que no deberia tocar (status, idempotency_key, client_alias), y los privilegios por columna no separan porque el mismo rol sirve al personal (probado: revocar update y conceder solo una columna bloquea tambien al camarero). Descartada mientras no haya roles separados. (B) Que el borde recalcule con contexto de personal. Es el patron que el proyecto ya rechazo para el precio: afirmar una identidad que no es la del actor, para una accion automatica. (C) Un rol de servicio acotado con BYPASSRLS que sea el unico que pueda ejecutar la funcion de cierre. Mantiene la integridad del dinero dentro de la base, el comensal nunca escribe un total, y el precio de linea ya lo fija el disparador que si funciona. Elegida, a pesar de introducir BYPASSRLS y de exigir una segunda llamada desde el borde.

## Consecuencias

Gana: los totales de la comanda dejan de depender de lo que envie el cliente y pasan a calcularse dentro de la base, que es donde la regla del dinero debe ser innegociable. El comensal no necesita escribir la comanda ni una sola vez, asi que el camino del pedido no cambia: crear comanda, anadir lineas, y el borde cierra los importes. Pierde: aparece el primer BYPASSRLS del proyecto, que es una capacidad peligrosa y hay que acotarla a una unica funcion y a un unico rol que no se use para nada mas; y el borde tiene una segunda llamada que puede olvidarse, cosa que hay que impedir con una restriccion (una comanda con lineas y total a cero tiene que ser imposible de cerrar). Se asume a cambio de que el descuento no venga del cliente.
