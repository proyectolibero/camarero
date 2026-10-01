---
id: ADR-0033
type: adr
title: La comanda se reparte por puesto de preparacion, y cada pantalla ve solo lo suyo y sin precios
status: accepted
date: 2026-10-01
tags:
  - comanda
  - cocina
  - barra
  - puestos
  - fase-1
related:
  - CONTRACT-estados-comanda
  - CONTRACT-modelo-datos
  - CONTRACT-pantallas
  - D-048
  - LL-025
  - TASK-F1-07
---

## Contexto

El humano creo un plato y una bebida y encontro el error al primer intento: la bebida aparecia en la pantalla de cocina, con precios, cuando una bebida va a la barra y no necesita que nadie la apruebe. Y anadio un hecho que condiciona el diseño: cada local puede tener varios puntos de acceso, con una pantalla para la cocina, otra para la barra, otra para la sala, o una sola con todo. La comanda de una mesa con un plato y una bebida no es una sola cosa que avanza de golpe.

## Decision

La comanda se REPARTE POR DESTINO al enviarse: la cesta se parte en una comanda por puesto de preparacion (el que ya trae cada plato en el esquema), y cada una avanza por su cuenta con su propio estado. Las pantallas de trabajo son POR PUESTO: cada dispositivo abre la suya y ve solo lo que le toca, y un local pequeno puede abrir la que muestra todo junto. La cocina NO ve los precios. Y un puesto que no necesita que nadie lo apruebe (la barra) nace aceptado: su proteccion no es la aceptacion, es que el local puede anular.

## Alternativas consideradas

1) Mantener una comanda unica y que cada pantalla filtre LINEAS por puesto. Descartado: con un estado por comanda, quien cocina arrastraria el estado de las bebidas y al reves; la barra no deberia esperar a que la cocina acepte nada, ni la cocina a que la barra sirva.
2) Un solo estado por linea dentro de la comanda. Descartado POR AHORA: es el modelo mas fiel, pero obliga a un segundo motor de estados, a un estado agregado de la comanda y a rehacer el cierre de importes. Se hara si el piloto demuestra que hace falta; empezar por el reparto por destino es mas simple y ya resuelve el error de verdad.
3) Dejar la aprobacion como esta, con todo pendiente de aceptar. Descartado: el humano lo dijo claro, una bebida es automatica; su proteccion no es que alguien la acepte, sino que el local puede anular desde su pantalla.

## Consecuencias

Se gana: cada destino recibe lo suyo, la cocina no ve precios ni bebidas, la barra no espera a nadie, y un local pequeno puede usar una sola pantalla con todo. Se pierde: la comanda se parte en varias y el importe de la mesa es la suma de sus partes, lo que hay que tener en cuenta al cobrar. Riesgo que se asume: dos comandas hermanas podrian quedar descuadradas si una se anula y la otra no; se resuelve diciendo en pantalla que son hermanas de la misma mesa, y se vigila con una prueba.
