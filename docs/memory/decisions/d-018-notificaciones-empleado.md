---
id: D-018
type: decision
title: "Notificacion al empleado: realtime, sonido y Web Push de respaldo"
status: accepted
date: 2026-09-27
tags: [producto, tecnico]
related: []
---

## Decision

La notificación al empleado usa Supabase Realtime como vía primaria, un sonido en la PWA
como refuerzo y Web Push (VAPID) solo como red de seguridad cuando la PWA está cerrada o en
segundo plano.

## Justificacion

Es lo más rápido y con menos fricción, y no depende de permisos del navegador para el caso
normal. Se prioriza de menor a mayor fricción: realtime, audio, vibración y push.

## Alternativas

- **Web Push como vía principal:** descartado porque depende de permisos y puede ser
  silenciado.
- **Solo sondeo periódico (polling):** descartado por latencia y consumo.
- **Correo o SMS:** descartados por coste y por lentitud.
