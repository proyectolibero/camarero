---
id: ADR-0034
type: adr
title: Los puestos y las pantallas los define y los nombra el dueno, y el reparto va de la categoria al plato
status: accepted
date: 2026-10-01
tags:
  - puestos
  - pantallas
  - carta
  - reparto
  - fase-1
related:
  - ADR-0033
  - CONTRACT-modelo-datos
  - CONTRACT-pantallas
  - D-048
  - D-053
  - LL-025
  - TASK-F1-07
  - TASK-F1-09
---

## Contexto

El humano respondio a las tres preguntas del modelo con una sola frase que lo cierra: «quiero nombrar yo los puestos de mi local, eso permite la maxima flexibilidad entre locales». La investigacion previa habia confirmado que el mercado converge en lo mismo, y que una tabla del esquema —kitchen_stations— lleva desde la primera migracion vacia y sin usar, porque el reparto se dejo en cinco valores fijos del codigo. Hay que pasar los puestos a ser datos del local.

## Decision

Los PUESTOS son datos del local y los nombra el dueno. Las PANTALLAS son agrupaciones de puestos, tambien del local, y cada dispositivo abre la suya. El REPARTO va de la categoria al plato: la categoria trae el puesto por defecto y el plato puede anularlo. Que un puesto no necesite aprobacion es una PROPIEDAD del puesto, no una lista escrita en el codigo. Y la comanda congela dos cosas del puesto: su identificador, para poder filtrar las pantallas, y su nombre, para que renombrarlo no reescriba la historia.

## Alternativas consideradas

1) Dejar los cinco valores fijos del esquema y que cada local se apañe. Descartado: el humano lo pidio explicito —«quiero nombrar yo los puestos de mi local»— y ademas el mercado hace lo contrario: Toast, Square, Lightspeed, Oracle y LS Central tratan los puestos como configuracion del local.
2) Puestos configurables pero pantallas fijas. Descartado: sin pantallas configurables, cada dispositivo tendria que elegir a mano que muestra y el local no podria dejar fijado el suyo; es justo lo que el humano advirtio que varia entre locales.
3) Admitir desde ya que un plato vaya a varios puestos. Descartado POR AHORA, y con el motivo escrito: el mercado lo soporta, pero parte la preparacion sin poder duplicar el cobro, y eso exige decidir antes DONDE se cobra cada linea. Meterlo ahora arriesga cobrar dos veces un plato. Se deja el modelo preparado para admitirlo y se decide con el caso delante.

## Consecuencias

Se gana: cada local nombra sus puestos como habla su gente (parrilla, plancha, postre) y decide que muestra cada pantalla; un local de una sola pantalla sigue funcionando sin tocar nada; y el reparto deja de estar en el codigo. Se pierde: hay que migrar los cinco valores fijos a datos del local, y el reparto pasa a depender de la configuracion, asi que un local mal configurado puede no ver una comanda. Mitigacion: una pantalla de puestos y pantallas con un juego por defecto sensato, y una prueba que avise si un plato queda sin destino. Riesgo que se asume: el identificador del puesto se congela en la comanda para poder filtrar, y su nombre tambien se congela para que la historia no cambie si el dueno lo renombra.
