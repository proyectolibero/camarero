---
id: TASK-F0-08
type: task
title: Adaptar el esquema y los roles para aplicarlo en Supabase
status: doing
date: 2026-09-29
phase: F0
tags:
  - supabase
  - infraestructura
  - rls
  - fase-0
related:
  - TASK-F0-04
  - ADR-0019
  - ADR-0020
  - CONTRACT-borde
acceptance:
  - "El esquema completo (28 tablas, 96 politicas, FORCE RLS, funciones) se aplica sin error en un Postgres que reproduce las restricciones de Supabase: rol administrador llamado postgres, sin superusuario camarero_admin, y sin poder crear roles con superusuario."
  - El borde se conecta con un rol que NO tiene BYPASSRLS y NO es propietario de ninguna tabla; se comprueba con un test que ese rol ve solo lo que la RLS le permite.
  - "La provision de roles es portable: el mismo codigo prepara el entorno local (Docker, con camarero_admin/owner/app) y el de Supabase (sin crear superusuarios ni roles que Supabase no admita)."
  - El script de migraciones decide el rol administrador segun el entorno y no crea roles con atributos prohibidos.
  - Tests en verde con evidencia registrada, incluida la suite actual (49 de base de datos) sin regresion.
  - Documentado en CONTRACT-borde como se aplica el esquema en Supabase y con que rol conecta el borde.
depends_on:
  - TASK-F0-02
doc: contracts/contract-borde-contract-borde-el-borde-de-cloudflare-pages-workers-y-r2.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Nuestro esquema se aplica hoy en un Postgres de Docker donde el runner crea camarero_admin (superusuario) y camarero_owner, y donde el borde usa camarero_app. Supabase es Postgres gestionado: no se pueden crear superusuarios y los roles son otros (postgres, authenticator, authenticated, anon, service_role). Hay que adaptar la provision de roles y el runner para que el mismo esquema se pueda aplicar en Supabase, y decidir con que rol conecta el borde alli (sin BYPASSRLS y sin ser propietario). Sin esta pieza, F0-04 no se puede probar contra el Supabase real. Diseno de referencia: ADR-0019 (puente de identidad) y ADR-0020 (conexion por Hyperdrive).

## Aceptacion

- [ ] El esquema completo (28 tablas, 96 politicas, FORCE RLS, funciones) se aplica sin error en un Postgres que reproduce las restricciones de Supabase: rol administrador llamado postgres, sin superusuario camarero_admin, y sin poder crear roles con superusuario.
- [ ] El borde se conecta con un rol que NO tiene BYPASSRLS y NO es propietario de ninguna tabla; se comprueba con un test que ese rol ve solo lo que la RLS le permite.
- [ ] La provision de roles es portable: el mismo codigo prepara el entorno local (Docker, con camarero_admin/owner/app) y el de Supabase (sin crear superusuarios ni roles que Supabase no admita).
- [ ] El script de migraciones decide el rol administrador segun el entorno y no crea roles con atributos prohibidos.
- [ ] Tests en verde con evidencia registrada, incluida la suite actual (49 de base de datos) sin regresion.
- [ ] Documentado en CONTRACT-borde como se aplica el esquema en Supabase y con que rol conecta el borde.

## Notas

- **2026-09-29** — EN CURSO. Trozo de portabilidad HECHO y verificado: se anadio el modo de base de datos (CAMARERO_DB_MODO=local|gestionado). En gestionado no se crea ningun superusuario ni dueno del esquema: se asegura camarero_app (crearRolSiNoExiste, tolera 42710), se revocan los permisos por defecto de anon, authenticated y service_role (que en Supabase tienen acceso a public y service_role ademas tiene BYPASSRLS), se aplican las migraciones como administrador y se conceden permisos. Verificado ejecutando la MISMA suite en los dos modos: local 49 pasan 0 fallan; gestionado 48 pasan 0 fallan 1 omitido (el test de propietario sujeto a FORCE, que solo aplica en local porque en gestionado el dueno es el administrador con BYPASSRLS). Sin regresion: rls sigue en 24 y el invariante de ciclos en []. typecheck 0, biome 0. RISK-020 registrado: la contrasena del rol propio no va en los backups y se pierde al despausar. FALTA: aplicar de verdad al proyecto de Supabase (necesita la cadena de conexion y las claves del usuario), el runbook de recuperacion de contrasena en CONTRACT-borde, y la verificacion contra el proyecto real. Depende de que el usuario termine de crear el proyecto.
