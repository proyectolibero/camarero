---
id: D-009
type: decision
title: "La comanda va directa a la cocina"
status: accepted
date: 2026-09-27
tags: [producto]
related: []
---

## Decision

La comanda del comensal se envía directa a cocina sin confirmación humana previa. Entra
como `pending` y el KDS la muestra al instante, con las capas anti-abuso de la sección 5.2.

## Justificacion

Reduce la fricción para el comensal y acorta el tiempo entre pedir y preparar. El control
se hace en el lado del local, que puede anular la comanda desde el KDS.

## Alternativas

- **Confirmación manual antes de enviar a cocina:** descartada por añadir fricción y
  retraso.
- **Envío solo tras aceptar un empleado:** descartado por convertir al empleado en cuello
  de botella.
- **Envío diferido agrupando comandas:** descartado por retrasar platos que deben empezar
  ya.
