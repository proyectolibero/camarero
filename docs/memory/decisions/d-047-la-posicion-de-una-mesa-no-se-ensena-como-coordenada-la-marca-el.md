---
id: D-047
type: decision
title: "La posicion de una mesa no se enseña como coordenada: la marca el mapa"
status: accepted
date: 2026-09-30
phase: F1
tags:
  - panel
  - mapa
  - interfaz
  - fase-1
related:
  - TASK-F1-04
  - ADR-0029
  - D-046
---

## Decision

En la pantalla de mesas se elimina la posicion en crudo («f1 c3»). La mesa elegida se señala sobre el propio mapa (contorno grueso) y su nombre aparece en el mando («Moviendo: Terraza 4»).

## Justificacion

La coordenada de fila y columna es jerga que el hostelero no necesita: el mapa ya dice donde esta cada mesa y cual se ha elegido. Enseñar «f1 c3» obliga a traducir numeros a una posicion visual que ya se ve. Elegir la mesa es un GET y queda en la URL, de modo que la pantalla sigue sin JavaScript (ADR-0029).

## Alternativas

(1) Dejar «f1 c3»: descartado, es jerga ilegible para quien usa el panel. (2) Escribirlo en palabras, «Fila 1 · Columna 3»: descartado, el mapa ya muestra la posicion y el texto añade ruido sin aportar nada que la vista no diga.
