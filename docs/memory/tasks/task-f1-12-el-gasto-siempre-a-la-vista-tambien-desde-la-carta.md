---
id: TASK-F1-12
type: task
title: El gasto siempre a la vista, tambien desde la carta
status: review
date: 2026-10-02
phase: F1
tags:
  - comensal
  - navegacion
  - usabilidad
  - fase-1
related:
  - CONTRACT-pantallas
  - D-055
  - D-056
  - TASK-F1-11
acceptance:
  - "El gasto acumulado y el enlace a su desglose estan visibles en TODAS las pantallas del comensal: la carta, la cesta, los pedidos y el estado del emparejamiento"
  - Desde la carta se llega al desglose en un toque, y se vuelve a la carta en un toque
  - El comensal ve cuanto lleva sin tener que entrar en ninguna otra pantalla
  - Si todavia no ha pedido nada, se dice de una forma que no confunda (no un cero sin explicacion)
  - La franja no tapa contenido ni molesta en un movil, y se lee de un vistazo
  - Una prueba comprueba que la franja aparece en todas las pantallas del comensal, y se ha demostrado capaz de fallar
  - "Sigue sin haber JavaScript: nada de botones flotantes ni posiciones resueltas con codigo"
  - "En vivo: el dueno pide algo, vuelve a la carta y sigue viendo su gasto y el camino al desglose"
depends_on:
  - TASK-F1-11
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm -r run test
  passed: true
  evidence: "2026-10-01 · pnpm -r run test · workers/api 345 pasan (antes 336, 9 nuevas), packages/db 133 pasan, packages/domain 17 pasan, tools/mcp-memory 95 pasan; 0 fallos. pnpm typecheck en verde y pnpm biome ci . sin errores. Nueva prueba tests/franja-gasto.test.ts (9 casos); demostrada capaz de fallar: quitando la franja, 4 casos en rojo. Previsualizaciones y capturas regeneradas y revisadas (LL-020)."
---

## Descripcion

Hallazgo de la prueba con el dedo del humano, despues de TASK-F1-11: la comunicacion con el comensal funciona (ve sus pedidos, sus estados y su acumulado), pero AL VOLVER A LA CARTA PIERDE EL ACCESO A ESA CUENTA. La informacion existe; el camino hasta ella no. Se anade una franja en la cabecera del comensal, presente en todas sus pantallas, con el gasto y el enlace al desglose (D-056). Es la misma leccion de siempre: lo que falla no es el dato, es el camino hasta el. NO incluye la cuenta ni el reparto (F3).

## Aceptacion

- [ ] El gasto acumulado y el enlace a su desglose estan visibles en TODAS las pantallas del comensal: la carta, la cesta, los pedidos y el estado del emparejamiento
- [ ] Desde la carta se llega al desglose en un toque, y se vuelve a la carta en un toque
- [ ] El comensal ve cuanto lleva sin tener que entrar en ninguna otra pantalla
- [ ] Si todavia no ha pedido nada, se dice de una forma que no confunda (no un cero sin explicacion)
- [ ] La franja no tapa contenido ni molesta en un movil, y se lee de un vistazo
- [ ] Una prueba comprueba que la franja aparece en todas las pantallas del comensal, y se ha demostrado capaz de fallar
- [ ] Sigue sin haber JavaScript: nada de botones flotantes ni posiciones resueltas con codigo
- [ ] En vivo: el dueno pide algo, vuelve a la carta y sigue viendo su gasto y el camino al desglose

## Notas

- **2026-10-02** — El gasto acumulado viaja con la carta (CartaDelComensal.subtotalAcumuladoClp), calculado con subtotalDePedidos/totalDeLineas, una sola funcion de totales. Franja sticky en la cabecera del comensal, presente en carta, cesta y pedidos, y ausente en las pantallas sin mesa. No se cierra: la prueba con el dedo es del humano.
