---
id: TASK-F0-07
type: task
title: Integridad de importes de la comanda y correcciones de alcance de la RLS
status: done
date: 2026-09-28
phase: F0
tags:
  - dinero
  - rls
  - seguridad
  - fase-0
related:
  - ADR-0008
  - ADR-0014
  - ADR-0015
  - D-039
  - RISK-018
  - LL-007
acceptance:
  - La proteccion de importes se implementa como efecto de un cambio de estado que ejecuta el personal (aceptacion de la comanda), NO como un UPDATE del comensal ni con un rol BYPASSRLS.
  - "Un comensal que inserta una comanda con discount_clp igual al bruto y total_clp a cero obtiene una comanda cuyos importes son los correctos: el descuento del cliente se descarta y el total nunca queda a cero. Verificado con el ataque ejecutado."
  - "El precio y el total de cada linea los fija la base desde menu_items: el comensal que envia unit_price_clp = 1 obtiene el precio de la carta. Los modificadores igual, desde modifier_options."
  - "Los modificadores no se pierden en el calculo: su delta se suma en la linea (verificado: 10000 + 900 = 10900). La via elegida es que el cierre recompute sumando los deltas, no un UPDATE cruzado desde el disparador de modificadores (cae en LL-007)."
  - El detector de ciclos sigue en [] con la politica nueva, y las funciones nuevas pasan el invariante de funciones SECURITY DEFINER endurecidas.
  - "Las dos correcciones de alcance estan aplicadas y probadas: el cobro se imputa a staff_actual() de quien lo registra, y un encargado sin local asignado alcanza su organizacion sin abrir el ciclo locations -> table_sessions -> locations."
  - Tests en verde con evidencia registrada, incluyendo los 30 tests de base de datos existentes sin regresion.
depends_on:
  - TASK-F0-02
doc: contracts/contract-dinero-reglas-de-dinero.md
tests:
  suite: pnpm test
  passed: true
  evidence: 2026-09-28 · pnpm test (raiz) · 137 pasan, 0 fallan, 0 omitidos (95 de tools/mcp-memory + 42 de packages/db) · pnpm typecheck exit 0 · pnpm biome ci . exit 0 · invariante de ciclos en [] (sin el ciclo locations -> table_sessions -> locations)
---

## Descripcion

Cerrar la integridad de importes de la comanda y las dos correcciones de alcance de la RLS. Diseno de referencia: ADR-0015 y D-039 fijan el rumbo; la via de cierre elegida es la transicion de estado que ejecuta el personal (aceptacion de la comanda), descartando ADR-0008 (el comensal no puede actualizar su comanda), ADR-0014 (BYPASSRLS no acotado) y el UPDATE cruzado desde el disparador de modificadores (cae en LL-007). Escribir las migraciones desde cero, verificando cada trozo con una prueba ejecutada antes de pasar al siguiente. Reemplaza el planteamiento original de la tarea, que partia del diseno de ADR-0008 hoy demostrado inviable.

## Aceptacion

- [ ] La proteccion de importes se implementa como efecto de un cambio de estado que ejecuta el personal (aceptacion de la comanda), NO como un UPDATE del comensal ni con un rol BYPASSRLS.
- [ ] Un comensal que inserta una comanda con discount_clp igual al bruto y total_clp a cero obtiene una comanda cuyos importes son los correctos: el descuento del cliente se descarta y el total nunca queda a cero. Verificado con el ataque ejecutado.
- [ ] El precio y el total de cada linea los fija la base desde menu_items: el comensal que envia unit_price_clp = 1 obtiene el precio de la carta. Los modificadores igual, desde modifier_options.
- [ ] Los modificadores no se pierden en el calculo: su delta se suma en la linea (verificado: 10000 + 900 = 10900). La via elegida es que el cierre recompute sumando los deltas, no un UPDATE cruzado desde el disparador de modificadores (cae en LL-007).
- [ ] El detector de ciclos sigue en [] con la politica nueva, y las funciones nuevas pasan el invariante de funciones SECURITY DEFINER endurecidas.
- [ ] Las dos correcciones de alcance estan aplicadas y probadas: el cobro se imputa a staff_actual() de quien lo registra, y un encargado sin local asignado alcanza su organizacion sin abrir el ciclo locations -> table_sessions -> locations.
- [ ] Tests en verde con evidencia registrada, incluyendo los 30 tests de base de datos existentes sin regresion.

## Notas

- **2026-09-28** — TROZO A COMPLETO Y VERDE. Migracion 0012_integridad_de_importes.sql: disparadores BEFORE INSERT en order_items y order_item_modifiers que copian nombre y precio/delta de la carta e ignoran lo que envie el cliente. Elegidos SECURITY INVOKER tras experimento: un SECURITY DEFINER lee como su dueno, no como el llamante, y con dueno superusuario abria fuga entre organizaciones (un comensal podia valorar un plato ajeno y leer su precio) y saltaba el filtro de disponibilidad. Con INVOKER, la RLS le da gratis las dos protecciones. Verificado: el comensal manda unit_price 1 y queda 1500 (el de la carta); el nombre se copia; la linea sin plato se rechaza; el delta 1 del modificador queda 500. Suite completa: 33 tests (rls 24, importes 3, runner 4, invariantes 2), 0 fallos, typecheck 0, biome 0. Ademas se corrigieron los comentarios de orders que describian subtotal como bruto menos descuento (contradecian D-039). FALTA: trozo B (cierre de importes en la transicion a aceptada) y trozo C (correcciones de alcance: cobro imputado a staff_actual() y encargado sin local que alcanza su organizacion). Lecciones LL-010 (backtick en template literal desconecto el test) y LL-011 (SECURITY DEFINER lee como su dueno).

- **2026-09-28** — Cerrada con los tres trozos verificados por pruebas ejecutadas. A: migracion 0012, el precio y el delta los fija la base desde la carta (disparadores SECURITY INVOKER). B: migracion 0013, la comanda nace pendiente con importes a cero y el cierre es efecto de pasar a aceptada (descuento del cliente descartado, lineas a su valor final, y no se admiten lineas ni modificadores tras aceptar). C: migracion 0014, un encargado sin local alcanza los locales, la carta y las comandas de su organizacion sin abrir el ciclo locations -> table_sessions -> locations, un camarero sin local no ve nada, y un cobro solo se imputa a quien lo registra. Tests nuevos: importes (3), cierre (3), alcance (6). ADR-0017 reemplaza a ADR-0008 y ADR-0014. Lecciones LL-010 y LL-011. El ataque verificado: comensal con descuento igual al bruto y total a cero, linea con precio 1 y modificador con delta 1; tras la aceptacion queda descuento 0, subtotal 2000 y total 2000.
