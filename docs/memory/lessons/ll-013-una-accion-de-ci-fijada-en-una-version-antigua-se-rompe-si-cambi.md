---
id: LL-013
type: lesson
title: Una accion de CI fijada en una version antigua se rompe si cambia el registro de su imagen
status: recorded
date: 2026-09-29
tags:
  - ci
  - seguridad
  - herramientas
  - fase-0
related: []
---

## Error

El workflow Puntuacion de seguridad fallo con 'Docker pull failed... gcr.io/openssf/scorecard-action/manifests/v2.4.0: denied: This API method requires billing to be enabled'. Reintento tres veces y fallo las tres, dejando un rojo permanente en cada push.

## Causa raiz

Fije la accion ossf/scorecard-action en v2.4.0. Esa version descarga su imagen de contenedor desde gcr.io (registro de Google), y el proyecto de Google que la aloja ahora exige facturacion, asi que el pull fue denegado. No es un fallo de nuestro codigo ni de configuracion: es una dependencia externa que cambio.

## Prevencion

Fijar las acciones de CI a una version vigente, no a una antigua, y cuando una accion se ejecuta como contenedor, saber de que registro se descarga su imagen. Ante un rojo permanente de una accion externa, comprobar primero donde vive su imagen antes de sospechar del repositorio. Se corrigio subiendo a v2.4.4, que usa ghcr.io. Regla general: una version fijada no solo hereda el codigo de entonces, hereda tambien su infraestructura, y esa puede caducar.
