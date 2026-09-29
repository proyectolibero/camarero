---
id: ADR-0019
type: adr
title: El inicio de sesion se traduce a contexto con dos cerraduras minimas, sin llave maestra
status: accepted
date: 2026-09-29
tags:
  - autenticacion
  - rls
  - supabase
  - seguridad
  - fase-0
related:
  - ADR-0001
  - ADR-0017
  - D-007
  - D-041
  - LL-002
  - CONTRACT-borde
  - TASK-F0-04
---

## Contexto

Las 96 politicas RLS leen la identidad de las variables de sesion app.staff_id, app.org_id, app.role y app.location_id, pero nada las producia porque no habia inicio de sesion. Supabase Auth entrega un token firmado (JWT) con la reclamacion sub, y las politicas no saben leerla. Aparece un problema de huevo y gallina: para leer la fila de staff hace falta identidad, y la identidad sale de esa misma fila. La tarea exige ademas dos mecanismos independientes (panel con email y contrasena; tablet con PIN) y que la clave de servicio nunca llegue al cliente.

## Decision

El borde (Cloudflare Worker) es la unica puerta: verifica la credencial y fija el contexto app.* antes de cada consulta. Para resolver el huevo y gallina se anaden dos cerraduras minimas de solo lectura: quien presenta un token de Supabase Auth puede leer la fila de staff cuyo auth_user_id coincide con la reclamacion sub, y quien presenta el token opaco de un dispositivo puede leer su fila de staff_devices. Con esa fila el borde ya conoce la organizacion, el local y el rol, y abre el resto de consultas con la identidad fijada. No se usa ningun rol con BYPASSRLS.

## Alternativas consideradas

(A) Un rol de servicio con BYPASSRLS para el borde, que resolviera la identidad leyendo staff sin politicas. Descartada: es la llave maestra que ADR-0017 rechazo para el dinero, y por el mismo motivo: el rol necesita DML y su superficie real termina siendo lectura entre organizaciones y escritura ciega. (B) Cambiar las 96 politicas para que lean el token de Supabase directamente (auth.jwt()), y que el cliente hable con la base por PostgREST. Descartada: reescribir todo el aislamiento ya probado, y el borde dejaria de ser la unica puerta. (C) Guardar el enlace entre el usuario y el empleado en una tabla sin politicas (fuera de la RLS). Descartada: crea una tabla sin proteccion en un esquema donde el aislamiento es la promesa central. (D) Que el cliente envie su propio staff_id al borde. Descartada de raiz: es exactamente LL-002, un control que el llamante configura no es un control; cualquiera se pondria el identificador de otro. (E) Dos cerraduras minimas mas, que dejan leer UNA fila a quien presenta la credencial correcta. Elegida.

## Consecuencias

Gana: el aislamiento existente no se toca y las cerraduras siguen siendo las mismas que ya estan probadas; no aparece ninguna llave maestra; el panel y la tablet son mecanismos independientes, que es lo que exige la tarea; y todo se puede probar en local sin depender de Supabase, porque la credencial es una variable de sesion. Pierde: el rol de aplicacion del borde puede fijar tanto el token como la identidad, de modo que la seguridad depende de que ese rol solo lo tenga el borde y no el cliente (ya era asi); y el enlace con auth.users no se declara como clave foranea, para que el esquema funcione en el Postgres de pruebas, asi que lo mantiene el borde. Se asume a cambio de no introducir una capacidad peligrosa para resolver un problema de identidad.
