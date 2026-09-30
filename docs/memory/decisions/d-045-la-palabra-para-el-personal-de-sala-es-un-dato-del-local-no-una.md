---
id: D-045
type: decision
title: La palabra para el personal de sala es un dato del local, no una constante del código
status: accepted
date: 2026-09-30
phase: F0
tags:
  - producto
  - vocabulario
  - panel
  - multi-pais
related:
  - OQ-004
  - D-043
  - ADR-0015
  - CONTRACT-pantallas
  - TASK-F0-09
---

## Decision

La palabra para el personal de sala es un DATO DEL LOCAL, no una constante del código. Hoy, con el piloto en Chile, el valor por defecto es «Garzón» y vive en un solo sitio (workers/api/src/panel/roles.ts) para que cambiarla cueste una línea. En F4 el dueño podrá escribir su propia palabra en los ajustes del local, y esa misma palabra alimentará también la pantalla del comensal («Llamar al ___»).

## Justificacion

El humano respondió al vocabulario con una objeción mejor que la pregunta: «las tres son correctas dependiendo del país, y queremos abarcar todo el universo en español». Tenía razón. La pregunta estaba mal planteada: no hay que elegir LA palabra, hay que hacer que cada local use LA SUYA. Un hostelero mexicano no debe ver nunca «garzón» en su panel, y uno chileno no debe ver «mesero»: la única fuente que siempre acierta es el propio dueño. Encaja con la premisa del proyecto de adaptarnos nosotros al local y no al revés.

## Alternativas

1) Elegir una palabra neutra («Personal de sala») y no complicarse. Descartado: el proyecto vende cercanía, y «personal de sala» es un organigrama, no una palabra que nadie use hablando.
2) Fijar una sola palabra y ya, la de Chile («Garzón»). Descartado porque contradice lo que el humano acaba de señalar con razón: en México es mesero y en España camarero, así que el mismo producto sonaría extranjero en cada país.
3) Traducir por variante de idioma (es-CL, es-MX, es-ES) desde el paquete de traducciones. Descartado POR AHORA, y por una razón concreta: obliga a que el producto sepa la variante del local, y ni siquiera dentro de un país la palabra es única (en Chile conviven «garzón» y «mesero» según la ciudad y el tipo de local). La traducción por variante resuelve muy bien los textos fijos del producto; para el nombre del propio personal, la mejor fuente es el propio local.
