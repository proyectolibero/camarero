---
id: ADR-0026
type: adr
title: El keep-alive de la base vive en un cron del borde, no en un cron de GitHub
status: accepted
date: 2026-09-30
tags:
  - operacion
  - borde
  - supabase
  - fase-0
related:
  - RISK-001
  - RISK-020
  - TASK-F0-05
  - ADR-0020
  - CONTRACT-borde
---

## Contexto

Supabase Free pausa el proyecto tras siete dias sin actividad (RISK-001), y al despausarlo se pierde la contrasena del rol del borde (RISK-020), lo que obliga a relanzar la instalacion del esquema. La tarea F0-05 pide un cron diario de keep-alive. Hay que decidir DONDE vive ese cron, porque no es lo mismo un cron del proveedor de la base, uno de GitHub o uno del borde.

## Decision

El keep-alive diario vive en un cron del propio Worker de Cloudflare (manejador programado), no en un cron de GitHub Actions. El borde consulta la base y ademas llama a su API REST, y deja constancia en el registro.

## Alternativas consideradas

1) Un cron de GitHub Actions que consulte la base a diario. Descartado por una trampa concreta: GitHub DESACTIVA los flujos programados tras 60 dias sin actividad en el repositorio, y este repositorio puede pasar semanas quieto. El keep-alive dejaria de funcionar en silencio, que es la peor forma de fallar: creyendo que hay red cuando no la hay.
2) Un monitor externo (del estilo de UptimeRobot) que llame al borde a diario. Descartado por ahora: anade una cuenta y una dependencia externa para algo que el borde ya puede hacer solo.
3) Dejar que el proyecto se pause y despausarlo a mano cuando haga falta. Descartado por RISK-020: al despausar, la contrasena de camarero_app queda vacia y hay que relanzar la instalacion del esquema. Ademas el producto estaria caido dias sin que nadie mire.

## Consecuencias

Se gana: el keep-alive depende de Cloudflare, que es quien aloja el proyecto y no se desactiva por falta de actividad; y se gana un manejador programado en el borde, que hara falta despues para otras tareas (limpieza, avisos). Se pierde: hay una pieza mas en el Worker y hay que acordarse de que existe al leer el codigo. Riesgo que queda vivo: sigue siendo una mitigacion, no una garantia; si Cloudflare no ejecuta el cron, el proyecto se pausa igual, y por eso el runbook debe decirlo y el propio borde deberia avisar (queda como trabajo posterior).
