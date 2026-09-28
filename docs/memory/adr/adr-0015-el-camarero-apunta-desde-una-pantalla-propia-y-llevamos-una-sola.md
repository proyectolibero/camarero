---
id: ADR-0015
type: adr
title: El camarero apunta desde una pantalla propia y llevamos una sola cuenta
status: accepted
date: 2026-09-28
tags:
  - producto
  - camarero
  - cuenta-unica
  - arquitectura
related:
  - D-004
  - D-019
  - RISK-004
  - RISK-018
---

## Contexto

La investigacion de mercado dejo tres hechos que obligan a decidir. (1) Ningun caso documentado de camareros que abandonen su TPV por un sistema de pedido en mesa: la corriente va al reves, los que sobreviven (Toast, Ziosk, Sunday, honei) se integran con el TPV, no lo sustituyen. (2) Toast, lider del sector, documenta que mezclar pedidos del movil y del camarero en dos sistemas produce cuentas que no cuadran, y lo resuelve prohibiendo la mezcla o separando subcuentas. (3) Yumminn quebro tras levantar 1,4 M y llegar a 350 locales, en parte por ser mas caro que el datafono que pretendia sustituir. A la vez, el usuario ha fijado como premisa de producto que la mayoria de locales son pequenos, con el dueno trabajando dentro, plantilla minima y sistemas rudimentarios, y que nosotros somos los ultimos en llegar y por tanto los que deben adaptarse, nunca exigir que el local se adapte. Eso descarta depender de la API de un TPV moderno: un bar de barrio no tiene Toteat.

## Decision

El camarero apunta los pedidos de viva voz desde una pantalla sencilla de botones (tablet barata del local, o movil del local en su defecto), no desde el TPV. Esa via es la base del sistema y funciona con o sin TPV. La integracion con TPV modernos con API publica (Toteat, Fudo) es una mejora opcional, no un requisito. Sea cual sea el origen del pedido, movil o camarero, la cuenta del comensal es una sola.

## Alternativas consideradas

(A) Integrar con la API del TPV del local como via principal. Descartada: solo funciona con TPV de nube con API publica (Toteat, Fudo), y el usuario ha fijado que el local tipico tiene un sistema rudimentario sin API. Depende de un tercero y de que el dueno active la API, y deja fuera al bar de barrio. (B) Que el camarero abandone su TPV y apunte todo en nuestro sistema, incluido lo de viva voz. Descartada: no hay un solo caso documentado de exito con esa tesis, es la razon por la que fracasan estos productos, y pide al camarero cambiar su forma de trabajar en el peor momento posible. (C) Que el cliente solo vea lo pedido desde el movil y lo de viva voz quede fuera de nuestra cuenta. Descartada: es exactamente el escenario que Toast documenta como causa de cuentas que no cuadran y conflictos con el cliente; contradice la transparencia total que el usuario ha fijado como requisito. (D) Que sea el dueno quien cuadre las dos listas al cerrar la mesa. Descartada: deja una cuenta incompleta ante el cliente durante toda la comida y traslada al dueno un trabajo manual que crece con cada mesa.

## Consecuencias

Gana: funciona en cualquier local, tenga TPV moderno, TPV viejo o ninguno; no depende de ninguna API de tercero; y da al comensal una unica cuenta con lo pedido por el movil y lo pedido de viva voz, que es el requisito de transparencia. El hardware es una tablet barata que el local puede comprar o tener ya, lo que encaja con el gasto minimo del piloto. Pierde: aparece una pantalla nueva que hay que construir, probar y mantener con un solo mantenedor, y hay que conseguir que el camarero la use; la friccion es menor que la de un TPV nuevo porque es un panel de botones, pero no es cero. Se asume que en el primer local el camarero la adopte, y si no lo hace, el sistema vuelve de facto al escenario de cuenta partida. Mitigacion a registrar: el modo camarero es una pantalla, no un TPV, y debe poder usarse en una tablet de gama baja.
