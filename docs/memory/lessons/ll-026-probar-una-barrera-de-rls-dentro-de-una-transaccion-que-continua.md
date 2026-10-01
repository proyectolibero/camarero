---
id: LL-026
type: lesson
title: Probar una barrera de RLS dentro de una transaccion que continua exige un savepoint
status: recorded
date: 2026-10-01
tags:
  - db
  - rls
  - testing
related: []
---

## Error

El test de packages/db de la sala fallo al intentar la comanda sin aprobar: la RLS la rechazo con un error y la transaccion quedo abortada, de modo que la aprobacion posterior en el mismo guion no pudo ejecutarse ("expected undefined to be 'pairing'").

## Causa raiz

Escribir directamente con cliente.query una sentencia que la RLS rechaza lanza un error de Postgres que aborta toda la transaccion. En los tests previos se usaba un helper que hacia rollback de la transaccion entera, asi que no se noto; aqui hacia falta seguir operando despues del fallo esperado.

## Prevencion

Cuando un test de base necesite comprobar un fallo esperado de la RLS y despues seguir en la misma transaccion, envolver el intento en `savepoint`/`release` y hacer `rollback to savepoint` en el catch; el error esperado no debe abortar el guion completo.

## Detalle

Visto en packages/db/tests/sala.test.ts al demostrar "sin aprobar no hay comanda" y "tras aprobar si hay comanda" en la misma transaccion.
