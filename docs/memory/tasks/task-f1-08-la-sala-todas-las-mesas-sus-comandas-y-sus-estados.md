---
id: TASK-F1-08
type: task
title: "La sala: todas las mesas, sus comandas y sus estados"
status: review
date: 2026-10-01
phase: F1
tags:
  - sala
  - mesas
  - comandas
  - emparejamiento
  - fase-1
related:
  - ADR-0022
  - ADR-0033
  - CONTRACT-pantallas
  - D-053
  - TASK-F1-04
  - TASK-F1-07
acceptance:
  - La sala muestra TODAS las mesas del local, sin filtrar por puesto, con el estado de cada una
  - Cada mesa deja ver sus comandas y el estado de cada una, y de que puesto son
  - Una mesa sin comandas se distingue de un vistazo de una mesa con comandas pendientes
  - El emparejamiento se puede aprobar desde la sala, y tambien desde las pantallas de puesto
  - Aprobar desde cualquier pantalla deja la sesion aprobada y el comensal puede pedir (se demuestra)
  - "La sala no muestra los importes de las comandas pendientes: es una pantalla de servicio, no de caja"
  - Un empleado de otro local no ve nada de esta sala (se demuestra)
  - Sin sesion no se ve ninguna mesa
  - El mapa sigue sin JavaScript y se refresca solo
  - "Pruebas: mesas con y sin comandas, sus estados, aprobar desde la sala, aprobar desde un puesto, aislamiento entre locales y sin sesion"
  - "En vivo: el dueno abre la sala, ve sus mesas con sus comandas y aprueba un emparejamiento desde ahi"
depends_on:
  - TASK-F1-07
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: true
  evidence: 2026-10-01 · pnpm -r run typecheck (0 errores) · pnpm biome ci . (0 errores) · @camarero/api 305 pasan, 0 fallan · @camarero/db 110 pasan, 0 fallan · @camarero/domain 17 pasan, 0 fallan
---

## Descripcion

Rebanada 5 de la Fase 1: la sala. La pantalla que el humano definio como «todas las mesas, sus comandas y sus estados» (D-053). Reutiliza el mapa visual de mesas de TASK-F1-04 y le anade el estado de cada mesa segun sus comandas, y el detalle de las comandas de una mesa con su puesto y su estado. Ademas, mueve la aprobacion del emparejamiento a donde tiene que estar: disponible tambien en las pantallas de puesto (barra, cocina), porque ningun puesto debe recibir pedidos de un comensal que nadie ha aceptado. NO incluye configurar pantallas por local: eso se decide despues de averiguar lo que necesita cada tipo de local. NO incluye cobros ni cuentas (F3).

## Aceptacion

- [ ] La sala muestra TODAS las mesas del local, sin filtrar por puesto, con el estado de cada una
- [ ] Cada mesa deja ver sus comandas y el estado de cada una, y de que puesto son
- [ ] Una mesa sin comandas se distingue de un vistazo de una mesa con comandas pendientes
- [ ] El emparejamiento se puede aprobar desde la sala, y tambien desde las pantallas de puesto
- [ ] Aprobar desde cualquier pantalla deja la sesion aprobada y el comensal puede pedir (se demuestra)
- [ ] La sala no muestra los importes de las comandas pendientes: es una pantalla de servicio, no de caja
- [ ] Un empleado de otro local no ve nada de esta sala (se demuestra)
- [ ] Sin sesion no se ve ninguna mesa
- [ ] El mapa sigue sin JavaScript y se refresca solo
- [ ] Pruebas: mesas con y sin comandas, sus estados, aprobar desde la sala, aprobar desde un puesto, aislamiento entre locales y sin sesion
- [ ] En vivo: el dueno abre la sala, ve sus mesas con sus comandas y aprueba un emparejamiento desde ahi

## Notas

- **2026-10-01** — Sala construida: GET /admin/sala (todas las mesas, cuatro estados por color+forma+texto, sin importes, meta refresh 20s), GET /admin/sala/<mesaId> con comandas por puesto y estado y anular por POST. Aprobacion movida a los puestos y a la sala (aviso con numero + boton, retorno por lista blanca). Tests: workers/api +36 (sala.test.ts 26, contraste-sala 8), packages/db +3 (sala.test.ts integra aprobar->pedir y aislamiento). Previsualizacion sala.html y sala-mesa.html generadas y revisadas. No se cierra: la prueba con el dedo es del humano.
