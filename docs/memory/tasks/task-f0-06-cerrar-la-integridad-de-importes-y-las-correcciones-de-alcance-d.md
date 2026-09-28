---
id: TASK-F0-06
type: task
title: Cerrar la integridad de importes y las correcciones de alcance de la RLS
status: cancelled
date: 2026-09-27
phase: F0
tags:
  - rls
  - dinero
  - fase-0
  - seguridad
related:
  - RISK-016
  - RISK-017
  - ADR-0008
  - ADR-0010
  - ADR-0011
  - ADR-0012
acceptance:
  - "Los totales de la comanda no se pueden manipular: insertar una comanda con discount_clp igual al bruto no puede dejar el total en 0"
  - Un cobro solo se puede registrar a nombre de quien lo hace, y la politica de checkouts vuelve a comprobar la organizacion y el local de la sesion
  - Un encargado sin local asignado ve los locales, la carta y las comandas de su organizacion, y un camarero sin local no ve nada
  - "Ninguna politica RLS introduce un ciclo: el test invariante de ciclos sigue en verde"
  - "No se pierde ninguna politica existente: la suite completa sigue en verde con los tests nuevos incluidos"
  - Cada afirmacion de cierre esta respaldada por una prueba ejecutada, no por una lectura del codigo
depends_on:
  - TASK-F0-02
doc: null
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Cerrar lo que quedo abierto en RISK-016, ahora que el metodo esta corregido y hay tests de invariantes que protegen el terreno.

Falta por hacer:

1. Los totales de la comanda no tienen proteccion en la base de datos. Un comensal puede insertar una comanda con discount_clp igual al bruto y el total queda en 0. El diseno esta en ADR-0008: disparador BEFORE sobre la propia fila. Hay que aplicarlo tambien a orders, no solo a las lineas.

2. Las dos correcciones de alcance que se verificaron como necesarias y que se perdieron al descartar las migraciones: el cobro se imputa a quien lo registra, y un encargado sin local asignado alcanza su organizacion sin provocar recursion. La segunda requiere cuidado: la version del intento 3 abria un ciclo nuevo (locations -> table_sessions -> locations) que el test invariante detecta ahora.

3. Reescribir desde cero, no parchear las descartadas.

Regla de metodo (ADR-0011 y LL-009): escribir un trozo, verificarlo con una prueba ejecutada, y solo entonces escribir el siguiente. No acumular SQL sin verificar.

## Aceptacion

- [ ] Los totales de la comanda no se pueden manipular: insertar una comanda con discount_clp igual al bruto no puede dejar el total en 0
- [ ] Un cobro solo se puede registrar a nombre de quien lo hace, y la politica de checkouts vuelve a comprobar la organizacion y el local de la sesion
- [ ] Un encargado sin local asignado ve los locales, la carta y las comandas de su organizacion, y un camarero sin local no ve nada
- [ ] Ninguna politica RLS introduce un ciclo: el test invariante de ciclos sigue en verde
- [ ] No se pierde ninguna politica existente: la suite completa sigue en verde con los tests nuevos incluidos
- [ ] Cada afirmacion de cierre esta respaldada por una prueba ejecutada, no por una lectura del codigo

## Notas

- **2026-09-28** — Cancelada por duplicado. Su contenido (integridad de importes + correcciones de alcance) se ha ejecutado y verificado integramente en TASK-F0-07, que se creo por error sin advertir que esta ya existia. La aceptacion de esta tarea queda cubierta asi: los totales no se pueden manipular (ataque con descuento igual al bruto cerrado, cierre.test.ts); un cobro solo se registra a nombre de quien lo hace (alcance.test.ts); un encargado sin local ve locales, carta y comandas de su organizacion y un camarero sin local no ve nada (alcance.test.ts); ninguna politica introduce ciclo (invariante en [], sin locations -> table_sessions -> locations); y no se pierde ninguna politica (42 tests de base de datos en verde). ADR-0017. No se cierra como done para no duplicar evidencia: queda como registro de lo que se absorbio.
