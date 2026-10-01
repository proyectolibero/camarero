---
id: LL-025
type: lesson
title: Se mando todo a una sola cocina, incluidas las bebidas, ignorando que el esquema ya sabia por donde va cada cosa
status: recorded
date: 2026-10-01
tags:
  - cocina
  - barra
  - comanda
  - producto
  - hallazgo
related: []
---

## Error

Se construyo una sola pantalla de cocina que recibia tambien las bebidas y que mostraba los precios, cuando cada plato tiene su puesto de preparacion y cada local tiene sus propios puntos de acceso.

## Causa raiz

Se diseño una pantalla unica llamada «cocina» y se metio todo ahi, dando por hecho que un local tiene un solo destino. El esquema ya traia la respuesta desde el primer dia: cada plato tiene su estacion de preparacion (frio, caliente, bar, postre, bebidas) y existe una tabla de puestos del local. El diseño no la consulto. Y encima la pantalla ensenaba los precios, que a quien cocina no le sirven para nada.

## Prevencion

Antes de disenar una pantalla operativa, preguntar quien la usa y que necesita ver, y buscar en el esquema que dice sobre por donde pasa el trabajo (aqui, la estacion de preparacion llevaba desde la primera migracion sin usarse). Y cuando algo se reparte por destinos distintos, el modelo tiene que representar cada destino, no meterlo todo en un saco.

## Detalle

El humano lo dijo en cuanto creo una bebida y un plato: «la bebida no necesita aprobacion de la cocina, es algo automatico», «para la cocina tampoco es necesario enviar el precio», y «cada local puede tener varios puntos de acceso: la cocina tiene su pantalla, la barra tiene otra, la sala, o todo junto». Tres cosas ciertas que obligan a rehacer el reparto de la comanda. Consecuencia de fondo: una comanda con un plato y una bebida NO es una sola cosa que avanza de golpe; son dos destinos que avanzan por separado, y el estado tiene que poder representarlo. Aprendido: antes de disenar una pantalla operativa hay que preguntar QUIEN la usa y QUE necesita ver, y mirar que dice el esquema sobre por donde pasa el trabajo.
