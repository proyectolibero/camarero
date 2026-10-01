---
id: D-053
type: decision
title: La sala tiene todas las mesas y sus estados; la aprobacion se hace desde cualquier pantalla; y las pantallas por local se averiguan antes de fijarlas
status: accepted
date: 2026-10-01
phase: F1
tags:
  - sala
  - pantallas
  - emparejamiento
  - fase-1
related:
  - ADR-0022
  - ADR-0033
  - CONTRACT-pantallas
  - TASK-F1-07
  - TASK-F1-08
---

## Decision

La sala es una pantalla PROPIA con TODAS las mesas, sus comandas y sus estados (nunca filtrada por puesto). El emparejamiento se aprueba SIEMPRE y desde CUALQUIER pantalla del local, porque ningun puesto debe recibir pedidos de un comensal que nadie ha aceptado. Y que un local tenga dos pantallas o una sola NO se decide aqui: las pantallas se podran configurar por local, y antes hay que averiguar que necesita cada tipo de local.

## Justificacion

El humano respondio a las tres preguntas y su segunda respuesta es la mas importante: «un local puede tener varias pantallas dependiendo un poco de su organizacion... o puede tener todo agrupado en una sola pantalla», y anadio «averiguar lo que necesitamos». Es una advertencia sensata: si fijamos ahora tres pantallas fijas, el primer local con otra estructura nos obliga a rehacerlo. Y su primera respuesta aclara algo que yo habia entendido mal en parte: la aprobacion del emparejamiento tiene que existir siempre y en cualquier pantalla, no solo en el panel del dueno.

## Alternativas

1) Dar por buenas las tres pantallas fijas (cocina, barra, todo) y seguir. Descartado: el humano ha dicho con razon que dependen de la organizacion de cada local, y fijarlas ahora obligaria a rehacerlo con el primer local que tenga otra estructura.
2) Inventar desde aqui un catalogo de puestos y pantallas. Descartado: seria adivinar. El humano pidio expresamente averiguar lo que se necesita, y eso se hace preguntando a locales reales y mirando como lo resuelven los sistemas que ya estan en el mercado.
