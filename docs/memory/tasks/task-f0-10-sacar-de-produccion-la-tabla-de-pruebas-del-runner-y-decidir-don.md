---
id: TASK-F0-10
type: task
title: Sacar de produccion la tabla de pruebas del runner y decidir donde vive el historial de migraciones
status: todo
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
  passed: false
  evidence: null
---

## Descripcion

Limpieza del esquema aplicado, arrastrada del cierre de TASK-F0-08. Dos cosas que viajaron a produccion sin querer: (1) la tabla prueba_runner, que existe para las pruebas del runner de migraciones y no pinta nada en la base real de un cliente; (2) el historial camarero_migraciones vive en el esquema public, donde cualquiera con acceso a la API lo ve. Ninguna de las dos rompe nada hoy, pero las dos son basura acumulada en la base de un cliente, y el proyecto presume de no acumularla.

## Aceptacion

- [ ] prueba_runner no existe en la base de produccion, y aplicar el esquema desde cero no la crea
- [ ] camarero_migraciones deja de vivir en el esquema public, o se decide de forma explicita y documentada que se queda ahi y por que
- [ ] Tras el cambio, el historial de migraciones sigue permitiendo repetir la instalacion (linea base) sin intentar recrear lo que ya existe
- [ ] Se demuestra aplicando el esquema desde cero en un entorno limpio, sin regresion en las suites
