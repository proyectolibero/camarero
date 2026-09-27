---
id: TASK-F0-02
type: task
title: "Crear el esquema de base de datos y RLS con un test por tabla"
status: todo
date: 2026-09-27
phase: F0
tags: [fase-0, datos, seguridad]
related: [D-028]
acceptance:
  - "El esquema inicial cubre orgs, locations, tables, staff, menu_items, orders y checkouts"
  - "Cada tabla tiene RLS activada y al menos una politica"
  - "Existe un test por tabla que falla si falta la politica o si un rol ve lo que no debe"
depends_on: [TASK-F0-01]
requires:
  tests: true
  doc: true
tests:
  suite: "pnpm test"
  passed: false
  evidence: null
doc: null
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
