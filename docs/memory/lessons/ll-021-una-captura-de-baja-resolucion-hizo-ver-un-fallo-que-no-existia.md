---
id: LL-021
type: lesson
title: Una captura de baja resolucion hizo ver un fallo que no existia
status: recorded
date: 2026-09-30
tags:
  - metodo
  - verificacion
  - interfaz
  - panel
related: []
---

## Error

Se interpreto mal una captura de pantalla y se estuvo a punto de reportar un fallo inexistente (un segundo precio tachado que no existe en el codigo).

## Causa raiz

Una captura reducida pierde detalle: a 780 px de ancho, un texto pequeno como "· Caliente" se convierte en manchas. Y el contexto empujo a la interpretacion equivocada: la fila era rosa (agotado), y una fila roja con numeros invita a leer "rebaja". El cerebro relleno el hueco. Lo que salvo el error fue ir a la FUENTE: leer el HTML generado, donde no habia ninguna etiqueta de tachado y habia un solo precio.

## Prevencion

Mirar SIEMPRE, y ante cualquier duda que nazca de una imagen, resolverla contra la fuente (el HTML o el CSS generados) antes de reportarla. La captura sirve para detectar que algo no cuadra; la fuente dice que es exactamente. Y cuando se reporte un fallo visual, llevar la prueba: la linea de HTML o el valor de contraste, no la impresion.

## Detalle

Revisando la captura de la carta, el arquitecto creyo ver dos precios en varias filas, uno de ellos tachado, y estuvo a punto de reportarlo como si el sistema hubiera inventado una funcion de descuento que no existe. Al comprobarlo contra el HTML de la previsualizacion (y contra la busqueda de etiquetas de tachado, que no aparecio ninguna) quedo claro que era una mala lectura de la imagen. Es el contrapeso exacto de LL-020: mirar es imprescindible, pero la imagen es un testigo de baja resolucion y la verdad esta en la fuente.
