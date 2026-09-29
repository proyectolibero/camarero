---
id: LL-014
type: lesson
title: La conexion directa de Supabase es solo IPv6 y los runners de GitHub no tienen IPv6
status: recorded
date: 2026-09-29
tags:
  - supabase
  - red
  - ci
  - infraestructura
  - fase-0
related: []
---

## Error

El workflow Instalar esquema fallo al conectar con 'connect ENETUNREACH 2600:1f14:...:5432' sobre una direccion IPv6. No llego a aplicarse ninguna migracion: el fallo fue antes de tocar la base.

## Causa raiz

Asumi que la cadena de conexion directa de Supabase funcionaria desde cualquier sitio, incluido un runner de GitHub. La conexion directa de Supabase resuelve solo a IPv6 salvo que se contrate el complemento IPv4; los runners de GitHub Actions no tienen salida IPv6. Lo mismo le pasara a cualquier maquina de desarrollo sin IPv6, como muchas conexiones domesticas y de oficina.

## Prevencion

Para todo lo que corra en un runner de GitHub (migraciones, despliegues) hay que usar el pooler de Supabase en modo sesion, que si tiene IPv4 (host aws-0-region.pooler.supabase.com y usuario postgres.PROJECT_REF), no la conexion directa. La conexion directa se reserva para donde si haya IPv6, como un Cloudflare Worker via Hyperdrive. Antes de dar por buena una conexion a un servicio gestionado, comprobar por que familia de direcciones resuelve el nombre. Queda anotado en CONTRACT-borde para no volver a tropezar.
