---
id: LL-018
type: lesson
title: En los runners de Ubuntu, pg_dump a secas resuelve al cliente 16 aunque se instale el 17
status: recorded
date: 2026-09-30
tags:
  - operacion
  - postgres
  - ci
  - copias
  - fase-0
related: []
---

## Error

Al volcar Supabase (PostgreSQL 17.6) desde el workflow de copias, pg_dump aborto con: "aborting because of server version mismatch... server version: 17.6; pg_dump version: 16.15 (Ubuntu 16.15-1.pgdg24.04+2)". El paso de instalacion de postgresql-client-17 habia pasado sin error, pero /usr/bin/pg_dump seguia apuntando al 16 que ya traia el runner.

## Causa raiz

Ubuntu y el runner de GitHub pueden tener varios clientes PostgreSQL conviviendo. El envoltorio /usr/bin/pg_dump no cambia al instalar una version nueva; pg_dump 16 no puede volcar un servidor 17 y aborta por incompatibilidad de version mayor.

## Prevencion

No invocar pg_dump/pg_restore por el nombre pelado en CI. Fijar la ruta explicita /usr/lib/postgresql/17/bin/pg_dump y usar esa misma en pg_restore (el mismo contenedor de fichero no lo lee un pg_restore mas viejo), y verificar la version en el registro antes de continuar.

## Detalle

Detectado en TASK-F0-05 (copias de seguridad). Ademas, al comprobar con \`file\` que la copia cifrada no es legible, el nombre del fichero (copia-r2.sql.age) hacia que grep -i sql diera un falso positivo: usar \`file -b\`, que omite el nombre.
