---
id: D-056
type: decision
title: El gasto y el acceso a su desglose estan siempre a la vista en todas las pantallas del comensal
status: accepted
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
  - TASK-F1-11
  - TASK-F1-12
---

## Decision

El GASTO ACUMULADO y el ACCESO A SU DESGLOSE estan SIEMPRE a la vista en todas las pantallas del comensal, en una franja de su cabecera: la carta, la cesta, los pedidos y el estado del emparejamiento. El comensal nunca tiene que volver a una pantalla concreta para saber cuanto lleva ni para entrar en el desglose.

## Justificacion

El humano probo el flujo completo y confirmo que la comunicacion entre el local y el telefono del comensal ya funciona: ve sus pedidos, sus estados y su acumulado. Pero encontro un fallo de navegacion: al volver a la carta se pierde el acceso a esa cuenta. La informacion existe y el camino hasta ella no. Es la misma leccion que ya nos costo una vez con el alta de platos: una pantalla puede estar correcta y aun asi ser inservible, porque lo que falla no es el dato, es el camino hasta el.

## Alternativas

1) Dejarlo como esta, con el desglose solo en su propia pantalla. Descartado por el humano: al volver a la carta se pierde el acceso, y la carta es donde mas tiempo pasa y donde decide si pide mas, que es justo cuando necesita saber cuanto lleva.
2) Ponerlo solo en la cesta. Descartado: la cesta es una pantalla de paso; el comensal que esta eligiendo no deberia tener que entrar a la cesta para saber cuanto lleva.
3) Un boton flotante con posicion fija. Descartado: en un movil tapa contenido y cae donde cae el pulgar; y sin JavaScript habria que resolverlo todo con posicionamiento, que en pantallas pequenas se pelea con el contenido.
4) Una franja en la cabecera del comensal, presente en todas sus pantallas. ELEGIDA: no tapa nada, es siempre el mismo sitio, y se lee de un vistazo.
