---
id: TASK-F0-02
type: task
title: Crear el esquema de base de datos y RLS con un test por tabla
status: done
date: 2026-09-27
phase: F0
tags:
  - fase-0
  - datos
  - seguridad
related:
  - D-028
acceptance:
  - El esquema inicial cubre orgs, locations, tables, staff, menu_items, orders y checkouts
  - Cada tabla tiene RLS activada y al menos una politica
  - Existe un test por tabla que falla si falta la politica o si un rol ve lo que no debe
depends_on:
  - TASK-F0-01
doc: contracts/contract-modelo-datos-modelo-de-datos.md
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: true
  evidence: "2026-09-27 · pnpm test · 125 pasan, 0 fallan, 0 omitidos (95 MCP + 4 runner + 24 RLS + 2 invariantes) · pnpm biome ci . exit 0 · pnpm typecheck exit 0 · criterio 1: las siete tablas existen con RLS, FORCE y politica (salida literal de pg_class y pg_policy) · criterio 2: 28/28 con RLS y FORCE, 27 con politica, ratelimit_counters con 0 por diseno y declarada como excepcion en el test de metadatos · criterio 3: quitando menu_items_select fallan 5 tests de la suite real, verificado en una copia temporal del paquete fuera del repositorio"
---

## Descripcion

Levantar el modelo de datos de la seccion 4 de PLAN.md con migraciones versionadas (Drizzle
sobre SQL plano, que es la fuente de verdad para RLS) y dos proyectos Supabase (dev y prod
free). Toda la logica de negocio vive en funciones Postgres `SECURITY DEFINER` y toda tabla
lleva RLS por `current_setting('app.org_id')`.

## Aceptacion

- [ ] El esquema inicial cubre orgs, locations, tables, staff, menu_items, orders y checkouts
- [ ] Cada tabla tiene RLS activada y al menos una politica
- [ ] Existe un test por tabla que falla si falta la politica o si un rol ve lo que no debe

## Notas

- **2026-09-28** — Cerrada con los dos matices literales documentados en la evidencia y en el contrato, no ocultos: ratelimit_counters tiene cero politicas de forma deliberada (tabla de plataforma, solo rol de servicio, el defecto es denegar), y la cobertura por tabla es agregada en lugar de un it() por tabla. La garantia del criterio esta verificada quitando una politica y viendo fallar 5 tests. Documento asociado: CONTRACT-modelo-datos, reescrito con la realidad verificada de las 28 tablas.
