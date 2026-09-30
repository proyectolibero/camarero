---
id: LL-020
type: lesson
title: Se dio por bueno un mapa de mesas que no se veia, porque nadie miro el resultado dibujado
status: recorded
date: 2026-09-30
tags:
  - metodo
  - interfaz
  - verificacion
  - panel
  - fase-1
related: []
---

## Error

Se dio por bueno un mapa de mesas en el que las mesas no se distinguian del fondo, porque nadie miro el resultado dibujado.

## Causa raiz

El metodo del proyecto verifica con pruebas ejecutadas, y eso funciona para la logica, los permisos y los datos. Pero una prueba comprueba que el SVG TIENE una ficha por mesa, no que una persona pueda VERLA. Nadie convirtio el resultado en una imagen y lo miro: ni el agente (que escribe texto) ni el arquitecto, que pego un fragmento de SVG creyendo que aquello era una comprobacion. Faltaba un paso entero: mirar.

## Prevencion

Todo lo que se VE (mapas, pantallas, hojas de QR, correos) se genera como una previsualizacion en ficheros estaticos y se MIRA antes de darlo por terminado. Las pruebas siguen siendo necesarias, pero no son suficientes para lo visual, y ninguna prueba de estructura sustituye a mirar. Es la tercera vez que el ojo del humano encuentra algo que la suite no podia ver; mas vale un paso mas en el metodo que tres correcciones del mismo tipo.

## Detalle

El humano movio una mesa, funciono, y aviso: las mesas se dibujaban con un color demasiado parecido al fondo de la cuadricula, asi que no se distinguian. Todo lo demas estaba bien. El fallo no es de logica ni de seguridad: es que el proyecto no tiene ningun paso en el que alguien MIRE lo que construye. Y es la segunda vez que el humano encuentra algo que las pruebas no podian ver (la primera fue el "Contrasena" sin enne y el rol mostrado como org_owner, D-043). Se arregla la causa, no el sintoma: a partir de ahora, lo que se ve se previsualiza y se mira antes de darlo por bueno.
