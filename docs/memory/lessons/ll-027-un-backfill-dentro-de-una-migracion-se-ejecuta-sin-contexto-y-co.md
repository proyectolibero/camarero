---
id: LL-027
type: lesson
title: Un backfill dentro de una migración se ejecuta sin contexto y con la RLS forzada ve cero filas
status: recorded
date: 2026-10-01
tags:
  - migraciones
  - rls
  - backfill
  - testing
  - fase-1
related: []
---

## Error

La migración 0021 copiaba los cinco valores fijos de estación a datos del local con un `insert ... select from locations` y varios `update ... from kitchen_stations`. Los tests de migración mostraron 0 puestos creados y 0 filas enlazadas.

## Causa raiz

La migración corre como camarero_owner, que desde 0010 está sujeto a FORCE ROW LEVEL SECURITY. Sin contexto de actor (app.org_id, app.staff_id, app.session_id), las políticas devuelven cero filas: el SELECT del backfill no veía nada y no fallaba, simplemente no migraba.

## Prevencion

Toda migración que lea o escriba datos existentes tiene que apagar la RLS en esas tablas dentro de su propia transacción y volver a encenderla al terminar; así el ROLLBACK también revierte el apagado. Y hay que probarlo con el esquema cortado en la migración anterior (`levantarEntornoDePruebas` acepta un directorio de migraciones) porque el propietario no es superusuario y la diferencia no se ve en Supabase, donde las migraciones corren como postgres.

## Detalle

Detectado al escribir la prueba migracion-puestos.test.ts de TASK-F1-09: el test levantaba el esquema hasta 0020, sembraba datos con el modelo viejo y aplicaba 0021. Es exactamente el caso que el humano pidió verificar (recuentos antes y después) y el que destapó el fallo.
