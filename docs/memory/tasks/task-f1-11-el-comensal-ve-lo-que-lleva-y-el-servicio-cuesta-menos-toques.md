---
id: TASK-F1-11
type: task
title: El comensal ve lo que lleva, y el servicio cuesta menos toques
status: review
date: 2026-10-01
phase: F1
tags:
  - comensal
  - servicio
  - estados
  - rapidez
  - fase-1
related:
  - ADR-0033
  - CONTRACT-estados-comanda
  - CONTRACT-pantallas
  - D-039
  - D-055
  - TASK-F1-07
  - TASK-F1-10
acceptance:
  - La pantalla del comensal se refresca sola mientras hay algo en marcha, y deja de refrescarse cuando ya no hay nada que contar
  - El comensal ve el estado de CADA comanda con palabras que entiende, y lo ve cambiar sin recargar a mano
  - El comensal ve un SUBTOTAL de todo lo que lleva pedido en la mesa, ademas del total de cada comanda
  - Una bebida pasa de aceptada a servida en UN SOLO toque, sin pasos intermedios que no aporten
  - "La maquina de estados y el contrato dicen lo mismo que la pantalla: los pasos que se quitan del flujo se quitan del modelo, no se esconden"
  - Se ha contado cuantos toques cuesta cada flujo real (una bebida en la barra, un plato en la cocina) y se ha reducido lo que sobraba
  - Se ha revisado el resto del servicio (la sala, aprobar un emparejamiento, anular) buscando pasos que no aportan, y se dice lo que se encontro
  - "Pruebas: el refresco mientras hay algo en marcha y su parada, el subtotal acumulado, la bebida servida en un toque, y el estado visible en palabras"
  - "En vivo: el dueno pide un plato y una bebida, los sigue desde el telefono viendo cambiar el estado, ve el acumulado, y sirve la bebida con un toque en la barra"
depends_on:
  - TASK-F1-10
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: true
  evidence: 2026-10-01 · pnpm test · domain 17/17, workers/api 336/336, packages/db 133/133; 0 fallos. pnpm typecheck y pnpm biome ci . en verde. CI y Despliegue (run 36942632030) en verde. Commit 1ef8e5a.
---

## Descripcion

Rebanada 7 de la Fase 1, nacida de la prueba con el dedo del humano: cinco defectos pequenos que juntos hacen que el producto se sienta lento y mudo. La pantalla del comensal deja de refrescarse en cuanto le aprueban la mesa (el refresco solo se activa mientras espera), asi que el comensal no sabe si su bebida se acepto; no existe un subtotal de lo que lleva pedido en la mesa; y una bebida que solo hay que entregar exige cuatro pasos entre aceptar y servir. Decision D-055: el comensal ve siempre que pidio, en que va y cuanto lleva gastado, y el servicio se mide en toques. NO incluye la cuenta ni el reparto (F3), ni los modificadores (F2).

## Aceptacion

- [ ] La pantalla del comensal se refresca sola mientras hay algo en marcha, y deja de refrescarse cuando ya no hay nada que contar
- [ ] El comensal ve el estado de CADA comanda con palabras que entiende, y lo ve cambiar sin recargar a mano
- [ ] El comensal ve un SUBTOTAL de todo lo que lleva pedido en la mesa, ademas del total de cada comanda
- [ ] Una bebida pasa de aceptada a servida en UN SOLO toque, sin pasos intermedios que no aporten
- [ ] La maquina de estados y el contrato dicen lo mismo que la pantalla: los pasos que se quitan del flujo se quitan del modelo, no se esconden
- [ ] Se ha contado cuantos toques cuesta cada flujo real (una bebida en la barra, un plato en la cocina) y se ha reducido lo que sobraba
- [ ] Se ha revisado el resto del servicio (la sala, aprobar un emparejamiento, anular) buscando pasos que no aportan, y se dice lo que se encontro
- [ ] Pruebas: el refresco mientras hay algo en marcha y su parada, el subtotal acumulado, la bebida servida en un toque, y el estado visible en palabras
- [ ] En vivo: el dueno pide un plato y una bebida, los sigue desde el telefono viendo cambiar el estado, ve el acumulado, y sirve la bebida con un toque en la barra

## Notas

- **2026-10-01** — Rebanada entregada, NO cerrada: falta la prueba con el dedo del humano. Refresco del comensal con meta refresh (10 s esperando aprobacion; 15 s con comandas sin servir; sin refresco si nada en marcha). Subtotal acumulado en datos.ts con totalDeLineas del dominio, excluyendo anuladas. Atajo aceptada->servida en packages/domain y CONTRACT-estados-comanda; la base ya lo permitia (trigger orders_cerrar_importes retorna early). Barra: 1 toque antes 3 (nace aceptada), cocina: 4 sin cambios. Resto del servicio ya a un toque (cerrar mesa, aprobar emparejamiento, anular). Previsualizaciones regeneradas y revisadas (comensal-pedidos y barra).
