---
id: LL-015
type: lesson
title: El usuario del pooler de Supabase (postgres.<ref>) rompe "alter default privileges for role" con error 42601
status: recorded
date: 2026-09-29
tags:
  - db
  - supabase
  - migracion
  - sql
  - roles
related: []
---

## Error

Al ejecutar el flujo "Instalar esquema" contra el pooler de Supabase: `error: syntax error at or near "."` con code 42601, position 43, en packages/db/scripts/preparar-roles.ts:56 (concederPermisosDeAplicacion), statement `alter default privileges for role ${autor.user} in schema public grant ...`. Ya no hay 28P01: la autenticacion pasa, falla el SQL.

## Causa raiz

El nombre de usuario del pooler es `postgres.<project-ref>` (contiene un punto). Se interpola como identificador SIN comillas en `alter default privileges for role`, y el parser de Postgres corta en el punto (posicion 43 = justo tras "postgres"). El mismo patron afecta a `asegurarRolDeAplicacion`/`prepararRoles` si se usara ese usuario.

## Prevencion

Entrecomillar todo identificador derivado de la cadena de conexion (comillas dobles, escapando `"`), o resolver el rol propietario real de las tablas con una consulta (p. ej. `current_user` / pg_class.relowner) en lugar de reutilizar el nombre de conexion. Añadir un test que ejecute el SQL de permisos contra el pooler o que verifique el entrecomillado de nombres con punto.

## Detalle

Observado el 2026-09-29 en la ejecucion 36642749260 de migrar.yml (commit ebd9f02). Diagnostico de credencial: "extremos con espacios o saltos: no; parece codificada en URL: no". Destino: aws-0-us-west-2.pooler.supabase.com:5432. Tarea relacionada: TASK-F0-08.
