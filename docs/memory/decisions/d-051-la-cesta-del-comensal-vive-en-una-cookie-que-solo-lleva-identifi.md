---
id: D-051
type: decision
title: La cesta del comensal vive en una cookie que solo lleva identificadores y cantidades, nunca precios
status: accepted
date: 2026-10-01
phase: F1
tags:
  - comanda
  - comensal
  - dinero
  - fase-1
related:
  - CONTRACT-dinero
  - CONTRACT-estados-comanda
  - CONTRACT-modelo-datos
  - ADR-0023
  - ADR-0031
  - TASK-F1-07
---

## Decision

La cesta del comensal vive en una COOKIE que lleva solo identificadores de plato y cantidades: NUNCA precios. El precio y el nombre se resuelven AL ENVIAR, desde la carta y a traves de la base, que es la que los fija. Cada dispositivo tiene su cesta, y eso es lo correcto porque cada comensal pide lo suyo; la cuenta de la mesa se compone despues, sumando las comandas de la sesion.

## Justificacion

Al llegar la comanda hay que decidir donde vive la cesta mientras el comensal elige. La restriccion que manda es que la pantalla del comensal NO tiene JavaScript, asi que no hay donde guardarla en el navegador. Y la regla de dinero del proyecto es tajante: el precio NUNCA viene del cliente. Una cookie que solo lleva identificadores y cantidades cumple las dos cosas: si alguien la manipula, puede cambiar QUE pide y CUANTO, pero no el precio, que lo fija la base desde la carta al enviar. Ademas evita tocar el esquema, cuyas restricciones y disparadores de integridad ya validan cada linea.

## Alternativas

1) Guardar la cesta en la base con una fila de comanda en borrador. Descartado por ahora: no existe el estado borrador (los estados reales son pendiente, aceptada, preparando, lista, servida, cerrada y anulada), habria que anadirlo con su migracion y su politica, y ademas dejaria comandas a medias de gente que se va sin pedir. Y el precio se congelaria al anadir el plato, no al enviar.
2) Guardar la cesta en la sesion de mesa con una tabla nueva. Descartado por lo mismo: es mas maquinaria de esquema y de RLS para algo que dura unos minutos y vive en un solo dispositivo.
3) Guardar la cesta en el almacenamiento del navegador. Descartado: el panel y la pantalla del comensal no tienen JavaScript por decision, asi que no hay donde guardarla sin abrir esa puerta.
