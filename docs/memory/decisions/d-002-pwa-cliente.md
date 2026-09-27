---
id: D-002
type: decision
title: "El cliente es una PWA abierta por QR o NFC"
status: accepted
date: 2026-09-27
tags: [producto, tecnico]
related: []
---

## Decision

El cliente del comensal es una PWA (aplicación web progresiva) que se abre escaneando un
QR o un tag NFC que apunta a una URL. No se instala nada y hay un solo código para todos
los dispositivos.

## Justificacion

Elimina la fricción de instalación y permite un único desarrollo que funciona en cualquier
móvil. Es coherente con el presupuesto cero y con el objetivo de máxima accesibilidad para
el comensal.

## Alternativas

- **App nativa iOS/Android:** descartada por coste de mantenimiento, publicación en tiendas
  y fricción de instalación.
- **Web tradicional sin capacidades PWA:** descartada porque perdería caché offline y
  notificaciones.
- **Bot de mensajería:** descartado por depender de plataformas de terceros.
