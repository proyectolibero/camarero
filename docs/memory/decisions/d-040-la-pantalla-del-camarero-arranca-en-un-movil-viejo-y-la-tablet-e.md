---
id: D-040
type: decision
title: La pantalla del camarero arranca en un movil viejo y la tablet es el premio si funciona
status: accepted
date: 2026-09-28
phase: F1
tags:
  - hardware
  - camarero
  - piloto
  - presupuesto
related:
  - ADR-0015
  - OQ-002
---

## Decision

La pantalla del camarero arranca en un movil Android, preferentemente uno viejo que ya tenga el local (coste cero). La tablet se compra despues, como premio, cuando el local confirme que el camarero usa la pantalla y el sistema le sirve. La tablet objetivo es una de gama de entrada nueva de unos 90.000-170.000 CLP, con funda antigolpes, y se asume que el enemigo real no es la caida sino el sol en terraza, la grasa y la bateria en jornadas largas. El objetivo sigue siendo que el dispositivo sea del local, no del camarero.

## Justificacion

El usuario ha fijado la opcion C: empezar a coste cero y comprar la tablet solo si el sistema demuestra que funciona. Hay tablets utiles por 90.000-170.000 CLP verificadas en tiendas chilenas, asi que el hardware no es un obstaculo economico, pero no tiene sentido gastarlo antes de validar la adopcion. El movil viejo del local cubre el arranque sin coste. Se documenta el dato del sol y la bateria porque son los fallos reales que nadie cuenta y condicionan la eleccion: la pantalla pequeña de un movil se lee mejor a pleno sol que la de una tablet barata de 400 nits, y la bateria aguanta un turno justo.

## Alternativas

(A) Comprar una tablet nueva barata desde el inicio (~90.000-170.000 CLP): es asumible, pero gasta dinero antes de saber si el camarero va a usar la pantalla. Descartada para el piloto. (B) Que cada camarero use su movil personal: mete una app del local en un telefono privado, el local no controla su herramienta y el camarero se la lleva al irse. Descartada como objetivo, aunque sirva de apaño. (C) Empezar directamente con tablet industrial resistente: existen (Unitech, Getac, Ruggtek) pero cuestan cientos de miles y se salen del presupuesto cero. Descartada.
