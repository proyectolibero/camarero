---
id: D-054
type: decision
title: La actividad de la sesion se mide en la propia sesion, no en table_devices
status: accepted
date: 2026-10-01
phase: F1
tags:
  - sesion
  - cierre
  - actividad
  - fase-1
related:
  - TASK-F1-10
  - ADR-0031
  - CONTRACT-protocolo-mesa
---

## Decision

La senal de actividad que alimenta el cierre por inactividad (4 h) es table_sessions.last_activity_at: la toca el comensal en cada interaccion (abrir la carta, pedir, enviar, ver pedidos) y el personal al aprobar o cerrar. table_devices.last_seen queda sin usar.

## Justificacion

El esquema ya declaraba table_devices.last_seen como la senal del cierre por inactividad, pero nadie lo escribia. El comensal ni siquiera crea dispositivos: la sesion es un token al portador, no un dispositivo identificado (ADR-0031 deja el token de dispositivo para F2). Hacer que el comensal cree y actualice dispositivos habria exigido una identidad de dispositivo que no existe. La actividad real y honesta es la de la propia sesion. Ademas se marca en el servidor en cada peticion, sin depender de un latido del cliente.

## Alternativas

1) Escribir table_devices.last_seen: exigia inventar un device_alias por sesion y una fila por dispositivo, con una identidad que F2 todavia no define. 2) Usar table_sessions.updated_at: se mueve tambien por cambios del panel (renovar ventana, aprobar, cerrar), asi que mezcla semantica y miente sobre que es actividad. 3) Cerrar por la antiguedad de la ultima comanda: una mesa sin pedidos pero abierta nunca cerraria, y una con el postre al final cerraria pronto.
