---
id: TASK-F1-07
type: task
title: "La comanda: de la cesta a la cocina"
status: doing
date: 2026-10-01
phase: F1
tags:
  - comanda
  - cocina
  - comensal
  - idempotencia
  - fase-1
related:
  - ADR-0031
  - ADR-0032
  - CONTRACT-dinero
  - CONTRACT-estados-comanda
  - CONTRACT-modelo-datos
  - CONTRACT-protocolo-mesa
  - D-051
  - TASK-F1-06
acceptance:
  - El comensal añade platos a su cesta, ve el resumen con el total, corrige cantidades y quita lineas
  - Al enviar se crea la comanda con sus lineas, y NO se puede enviar con una sesion sin aprobar (la barrera de base lo impide)
  - Reenviar el mismo envio (doble toque o reintento de red) NO crea dos comandas, y se demuestra
  - "Manipular la cookie de la cesta no cambia el precio: el precio lo fija la base desde la carta al enviar, y se demuestra"
  - "La comanda llega a la cocina: se ve en la pantalla de pedidos con su mesa y sus lineas"
  - La cocina puede aceptar y anular, y el estado se ve
  - El comensal ve el estado de sus comandas
  - Un comensal de OTRA sesion no ve ni puede tocar esta comanda (se demuestra)
  - Antes de enviar hay un aviso claro de que la comanda va a cocina, y el resumen con el total
  - "Pruebas: cesta (anadir, quitar, cantidad), enviar, idempotencia, sin aprobacion falla, la cocina ve y acepta y anula, aislamiento entre sesiones, y precio manipulado ignorado"
  - "En vivo: el dueno pide desde su telefono y ve la comanda llegar a la cocina del panel"
depends_on:
  - TASK-F1-06
doc: contracts/contract-estados-comanda-estados-de-la-comanda.md
tests:
  suite: pnpm -r run test
  passed: true
  evidence: '2026-10-01 · pnpm -r run test · workers/api 263 (antes 239, +24), packages/db 100 (antes 94, +6), packages/domain 8 (nuevo), 0 fallan. pnpm typecheck 0; pnpm biome ci . exit 0. En vivo tras Despliegue: GET /t/CJ88JYEK -> 200 text/html con action="/t/CJ88JYEK/cesta" y el boton por plato; GET /admin/pedidos sin sesion -> 200 con la entrada y sin ninguna comanda. CI 36807323735 y Despliegue 36807402928 en verde. NO se cierra: la prueba con el dedo es del humano.'
---

## Descripcion

Rebanada 4 de la Fase 1: la comanda. El comensal, ya emparejado y aprobado, elige platos, ve el resumen con el total y ENVIA; la comanda nace con sus lineas y LLEGA A LA COCINA, donde el local la ve, la acepta o la anula. La cesta vive en una cookie que solo lleva identificadores y cantidades, nunca precios (D-051), y el precio lo fija la base desde la carta al enviar (CONTRACT-dinero). Incluye las capas anti-abuso que ya tocan en esta fase: el resumen antes de enviar, el aviso inequivoco, la idempotencia (que ya existe en el esquema y hoy no se usa) y la anulacion desde la cocina. NO incluye modificadores ni notas (F2), ni el tope de lineas ni la ventana de calma (F2), ni la toma de comanda por el camarero, ni la cuenta. La cocina se ve en el panel: la superficie /staff es posterior.

## Aceptacion

- [ ] El comensal añade platos a su cesta, ve el resumen con el total, corrige cantidades y quita lineas
- [ ] Al enviar se crea la comanda con sus lineas, y NO se puede enviar con una sesion sin aprobar (la barrera de base lo impide)
- [ ] Reenviar el mismo envio (doble toque o reintento de red) NO crea dos comandas, y se demuestra
- [ ] Manipular la cookie de la cesta no cambia el precio: el precio lo fija la base desde la carta al enviar, y se demuestra
- [ ] La comanda llega a la cocina: se ve en la pantalla de pedidos con su mesa y sus lineas
- [ ] La cocina puede aceptar y anular, y el estado se ve
- [ ] El comensal ve el estado de sus comandas
- [ ] Un comensal de OTRA sesion no ve ni puede tocar esta comanda (se demuestra)
- [ ] Antes de enviar hay un aviso claro de que la comanda va a cocina, y el resumen con el total
- [ ] Pruebas: cesta (anadir, quitar, cantidad), enviar, idempotencia, sin aprobacion falla, la cocina ve y acepta y anula, aislamiento entre sesiones, y precio manipulado ignorado
- [ ] En vivo: el dueno pide desde su telefono y ve la comanda llegar a la cocina del panel

## Notas

- **2026-10-01** — Commit ef14413. Cesta en cookie camarero_cesta (solo id:cantidad, nunca precios); envio POST /t/<codigo>/cesta/enviar con idempotency_key unica; cocina GET /admin/pedidos con refresco meta 15 s. Matriz de estados en packages/domain/order-state.ts con 100% de cobertura. Prueba literal pedida en cada caso (idempotencia dos envios -> una comanda; sin aprobacion falla; precio manipulado ignorado; aislamiento). Previsualizacion cesta.html y cocina.html mirada; se corrigio una colision CSS (.pedido-total) que dibujaba una raya en la cabecera de la comanda.
