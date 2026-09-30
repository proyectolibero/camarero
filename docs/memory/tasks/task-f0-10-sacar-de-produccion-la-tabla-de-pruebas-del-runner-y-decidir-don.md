---
id: TASK-F0-10
type: task
title: Sacar de produccion la tabla de pruebas del runner y decidir donde vive el historial de migraciones
status: done
date: 2026-09-30
phase: F0
tags:
  - limpieza
  - esquema
  - supabase
  - fase-0
  - deuda
related:
  - TASK-F0-08
  - CONTRACT-borde
  - TASK-F0-10
acceptance:
  - prueba_runner no existe en la base de produccion, y aplicar el esquema desde cero no la crea
  - camarero_migraciones deja de vivir en el esquema public, o se decide de forma explicita y documentada que se queda ahi y por que
  - Tras el cambio, el historial de migraciones sigue permitiendo repetir la instalacion (linea base) sin intentar recrear lo que ya existe
  - Se demuestra aplicando el esquema desde cero en un entorno limpio, sin regresion en las suites
depends_on:
  - TASK-F0-08
doc: contracts/contract-borde-contract-borde-el-borde-de-cloudflare-pages-workers-y-r2.md
tests:
  suite: pnpm test
  passed: true
  evidence: "2026-09-30 · pnpm test · workers/api 61 + packages/db 57 + tools/mcp-memory 95 = 213 pasan, 0 fallan. pnpm typecheck 0; pnpm biome ci . 0. Aplicado en el Supabase real (workflow \"Instalar esquema\", run 36773165418, success): 16 migraciones en el historial, 29 tablas en public (eran 30), 98 politicas, y aislamiento de 0 filas sin contexto. Comprobado con consulta real que prueba_runner ya no existe: select to_regclass('public.prueba_runner') is null → true. Y demostrado que aplicar el esquema desde cero NO la crea (packages/db/tests/historial.test.ts)."
---

## Descripcion

Limpieza del esquema aplicado, arrastrada del cierre de TASK-F0-08. Dos cosas que viajaron a produccion sin querer: (1) la tabla prueba_runner, que existe para las pruebas del runner de migraciones y no pinta nada en la base real de un cliente; (2) el historial camarero_migraciones vive en el esquema public, donde cualquiera con acceso a la API lo ve. Ninguna de las dos rompe nada hoy, pero las dos son basura acumulada en la base de un cliente, y el proyecto presume de no acumularla.

## Aceptacion

- [ ] prueba_runner no existe en la base de produccion, y aplicar el esquema desde cero no la crea
- [ ] camarero_migraciones deja de vivir en el esquema public, o se decide de forma explicita y documentada que se queda ahi y por que
- [ ] Tras el cambio, el historial de migraciones sigue permitiendo repetir la instalacion (linea base) sin intentar recrear lo que ya existe
- [ ] Se demuestra aplicando el esquema desde cero en un entorno limpio, sin regresion en las suites

## Notas

- **2026-09-30** — Cerrada. (1) prueba_runner fuera: se elimino la migracion 0001 que la creaba, se movio su creacion a las pruebas, y la migracion 0016 la retira en las bases donde ya existia. En Supabase queda comprobado que no esta. (2) camarero_migraciones DECIDE QUEDARSE EN public, con motivo escrito: moverlo a un esquema propio dejaria la linea base vacia en la base ya instalada, el runner marcaria TODAS las migraciones como aplicadas sin ejecutarlas, y prueba_runner habria sobrevivido — es decir, la mudanza habria causado justo el dano que venia a evitar. La seguridad se resuelve con permisos, no con ubicacion, y hay una prueba que lo demuestra de verdad: simula el estado de Supabase, comprueba que los tres roles SI podian leerlo (la prueba no es vacua), ejecuta el aprovisionamiento y comprueba con un SELECT real conectandose como cada rol que ya no pueden. HALLAZGO aparte, registrado como riesgo: el flujo de recuperacion de contrasena de RISK-020 puede fallar con 28P01 por la cache del pooler justo despues de rotar la contrasena.
