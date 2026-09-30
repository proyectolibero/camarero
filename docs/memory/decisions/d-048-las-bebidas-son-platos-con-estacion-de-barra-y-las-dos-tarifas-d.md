---
id: D-048
type: decision
title: Las bebidas son platos con estacion de barra, y las dos tarifas de un vino llegan con los modificadores
status: accepted
date: 2026-09-30
phase: F1
tags:
  - carta
  - bebidas
  - producto
  - fase-1
related:
  - CONTRACT-modelo-datos
  - CONTRACT-dinero
  - CONTRACT-pantallas
  - D-036
  - TASK-F1-05
---

## Decision

Las bebidas son platos como cualquier otro, con la estacion de preparacion puesta en la barra para que la comanda no vaya a la cocina. Una ficha tiene UN precio; el caso de la copa y la botella del mismo vino se resuelve con los modificadores de la Fase 2, y mientras tanto el dueno crea dos fichas. Y como una carta de barra puede tener cien fichas, el panel ofrece DUPLICAR una ficha para no teclearla entera otra vez.

## Justificacion

El humano aviso: «deberemos tener todas las bebidas del establecimiento». Una carta de barra de un local normal son entre cuarenta y cien referencias, y eso cambia el diseno: no basta con un formulario bonito, hace falta que meter la ficha numero cincuenta sea rapidisimo. Ademas, una bebida NO va a la cocina: va a la barra, y eso ya lo distingue el modelo con la estacion de preparacion. Y el caso de la copa y la botella del mismo vino es el mas comun de todos, asi que conviene decir ahora como se resuelve en lugar de descubrirlo con el primer hostelero delante.

## Alternativas

1) Una tabla aparte solo para bebidas. Descartado: duplicaria categorias, precios, fotos, disponibilidad y toda la maquinaria de la carta para nada. Lo unico que diferencia una bebida es a donde va la comanda y algun atributo; no merece un modelo paralelo.
2) Dos precios en la ficha desde ya (copa y botella). Descartado: es un cambio de esquema que el sistema de modificadores de la Fase 2 ya resuelve, y hacerlo antes significa migrarlo despues. Se hace una vez, no dos.
3) Anadir columnas de volumen, graduacion, marca y formato ahora. Descartado: inventar columnas antes de saber cuales usa de verdad un hostelero es como se acaba con doce columnas vacias. Hasta que el piloto lo pida, eso va en el nombre y la descripcion.
