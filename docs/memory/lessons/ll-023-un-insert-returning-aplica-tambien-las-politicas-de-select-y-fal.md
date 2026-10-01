---
id: LL-023
type: lesson
title: Un INSERT ... RETURNING aplica tambien las politicas de SELECT y falla como violacion de INSERT
status: recorded
date: 2026-10-01
tags:
  - rls
  - comensal
  - postgres
  - testing
related: []
---

## Error

Al crear la sesion de mesa del comensal, el INSERT fallaba con 42501 "new row violates row-level security policy for table table_sessions", aunque la politica de insercion (con WITH CHECK escrito a mano y comprobado) era verdadera. El mensaje apuntaba a INSERT y despistaba.

## Causa raiz

La sentencia era `insert ... returning id`. PostgreSQL, cuando un INSERT lleva RETURNING, aplica tambien las politicas de SELECT a la fila devuelta. En ese instante la sesion aun no estaba en el contexto (app.session_id se fija despues), asi que la politica de SELECT no la veia y la sentencia entera se rechazaba con un error que nombra INSERT. Costo varios diagnosticos (igualar la condicion dentro del disparador, `with check (true)`) antes de dar con que el problema no era el WITH CHECK.

## Prevencion

Cuando una insercion forma parte de un camino de identidad "huevo y gallina" (crear el objeto cuya clave se necesita para fijar el contexto), no usar RETURNING: generar el identificador en el borde (crypto.randomUUID) e insertarlo explicito, y leer la fila despues, ya con el contexto fijado. Si un test dice "violates RLS for INSERT" y el WITH CHECK es verdadero, sospechar del RETURNING (SELECT) antes de tocar el WITH CHECK.

## Detalle

Camino del comensal de TASK-F1-06. La solucion final: el borde genera el uuid de la sesion, inserta sin RETURNING y luego fija app.session_id. La prueba de la cerradura (packages/db/tests/comensal.test.ts) usa el mismo patron.
