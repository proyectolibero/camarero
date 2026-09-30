---
id: D-046
type: decision
title: La celda ocupada se rechaza con aviso; la cuadricula solo crece hacia abajo y a la derecha
status: accepted
date: 2026-09-30
phase: F1
tags:
  - panel
  - mapa
  - mesas
  - fase-1
related:
  - ADR-0029
  - TASK-F1-04
---

## Decision

Mover una mesa a una celda ya ocupada se rechaza con un mensaje claro y no se toca ninguna mesa. El movimiento solo se bloquea en los bordes superior e izquierdo (no hay indices negativos); hacia abajo y a la derecha la cuadricula crece para acomodar la mesa.

## Justificacion

Rechazar mantiene "un boton, una mesa": intercambiar moveria en silencio una mesa que el dueno no pretendia tocar, justo donde un toque con el pulgar se equivoca mas facil. El rechazo es determinista y no puede quedar a medias. La cuadricula crece hacia abajo y a la derecha porque, con un minimo fijo de 6x4, bloquear el borde derecho dejaria muerto el crecimiento que promete ADR-0029; el unico borde real es el indice 0.

## Alternativas

(A) Intercambiar las dos mesas en una sola operacion atomica. Descartado por ahora: mueve dos mesas con un solo boton y sorprende; ADR-0029 pide previsibilidad, no un juego de piezas. (B) Bloquear tambien el borde derecho e inferior y no crecer nunca. Descartado: contradice "la cuadricula crece si alguna mesa esta mas lejos". (C) Ignorar el choque en silencio y dejar la mesa donde estaba. Descartado: la aceptacion exige explicarlo en pantalla.
