---
id: D-042
type: decision
title: Se congela el armazon antes que las pantallas y se respeta el orden del roadmap
status: accepted
date: 2026-09-30
phase: F0
tags:
  - proceso
  - alcance
  - panel
  - fase-0
related:
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - CONTRACT-pantallas
  - RISK-007
---

## Decision

Las pantallas se construyen por rebanadas en el orden del roadmap, y se empieza por el ARMAZON (una sola manera de dibujar, de entrar y de comprobar permisos). No se adelantan fases: un panel con cuatro pantallas que funcionan vale mas que treinta a medias. El inventario completo queda escrito en CONTRACT-pantallas para que nada se olvide.

## Justificacion

El humano pidio "preparar todas las pantallas desde ya". La lectura correcta de esa peticion no es escribir treinta pantallas a la vez, sino dejar congelado lo que hace barata cada pantalla futura. Ademas la Fase 0 sigue abierta y la prueba definitiva de identidad (TASK-F0-04) espera un inicio de sesion real: el armazon es justo lo que la desbloquea. Y el roadmap ya asigna cada pantalla a una fase, de modo que la peticion no exige alcance nuevo, solo orden.

## Alternativas

1) Construir las ~27 pantallas del inventario antes de seguir, como pidio el humano en un primer momento. Descartado: deja decenas de pantallas a medias y ninguna verificable, y choca de frente con RISK-007 (alcance excesivo para una sola persona) y con el metodo del proyecto (cada trozo se verifica antes de seguir).
2) Construir solo la pantalla que hace falta hoy, sin fijar antes el armazon. Descartado: cada pantalla inventaria su propia manera de entrar, de comprobar permisos y de dibujar, y despues hay que rehacerlas todas.
3) Adoptar un framework de interfaz para acelerar. Descartado por ADR-0023.
