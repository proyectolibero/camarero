---
id: ADR-0020
type: adr
title: El borde habla con Postgres por Hyperdrive sin cache y fija el contexto en una transaccion corta
status: accepted
date: 2026-09-29
tags:
  - infraestructura
  - borde
  - postgres
  - rls
  - fase-0
related:
  - ADR-0001
  - ADR-0002
  - ADR-0019
  - CONTRACT-borde
  - RISK-001
  - RISK-009
  - TASK-F0-04
---

## Contexto

Las politicas RLS leen la identidad de variables de sesion app.*, que el borde debe fijar antes de consultar. El borde es un Cloudflare Worker; la base es Supabase Postgres. Hacia falta decidir por donde habla el Worker con Postgres, con presupuesto cero. Se investigaron las vias disponibles con sus limites y costes reales. Dato clave: PostgREST, la via que recomienda Supabase, solo expone variables request.* con los claims del token y no permite fijar app.*, de modo que usarlo obligaria a reescribir las 96 politicas ya probadas.

## Decision

El Worker habla con Supabase Postgres a traves de Cloudflare Hyperdrive con el cache DESACTIVADO, usando el driver pg con nodejs_compat, conectado con un rol sin BYPASSRLS y no propietario de las tablas. En cada peticion fija el contexto app.* con set_config(clave, valor, true) al inicio de una transaccion explicita y corta, de modo que el contexto vive en la transaccion y se descarta al devolver la conexion al pool. Nunca se fija contexto a nivel de sesion.

## Alternativas consideradas

(A) PostgREST o @supabase/supabase-js: funciona por HTTP y no gestiona conexiones, pero NO permite fijar las variables app.* que leen nuestras politicas, y usarlo obligaria a reescribir las 96 politicas para que lean el token. Descartada: es la alternativa B que ADR-0019 ya rechazo, y tira por la borda un aislamiento ya probado. (B) Conexion TCP directa sin Hyperdrive (connect() de cloudflare:sockets o pg-cloudflare): posible, pero paga el saludo TLS en cada invocacion, tiene un limite de 6 conexiones simultaneas y obliga a gestionar el pool a mano. Descartada porque Hyperdrive es gratis y hace justo eso. (C) Supavisor (pooler de Supabase) directo: es el plan B si Hyperdrive no alcanza la conexion directa; exige desactivar sentencias preparadas y un ajuste de TLS, y es mas fragil. Se guarda como respaldo, no como via principal. (D) fijar el contexto a nivel de sesion (set_config con is_local = false): con pooling en modo transaccion la conexion se reutiliza y el contexto puede filtrarse a la peticion siguiente. Descartada por inseguridad. (E) un rol con BYPASSRLS: ya descartada en ADR-0017.

## Consecuencias

Gana: coste cero dentro del plan gratuito (100.000 consultas al dia), ninguna politica cambia, y la semantica de pooling es la correcta (el contexto vive en la transaccion y muere con ella). Pierde: aparece Hyperdrive como pieza nueva de Cloudflare, con su propio cupo; cada sentencia cuenta en ese cupo, incluido el propio set_config, asi que una peticion gasta mas de una; y la suposicion de que Hyperdrive alcanza la conexion directa IPv6 de Supabase esta medida por terceros pero NO documentada por Cloudflare, de modo que hace falta una verificacion temprana con Supavisor como respaldo. Ademas sigue vigente RISK-001: el plan gratuito de Supabase se pausa por inactividad. Y una consecuencia de seguridad ya asumida en ADR-0019: la credencial de la base pasa a ser la frontera, porque quien la tenga puede fijar app.* y hacerse pasar por otro; debe vivir solo como secreto del borde y ser rotable.
