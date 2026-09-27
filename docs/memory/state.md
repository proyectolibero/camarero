---
id: state
type: state
title: "Estado actual del proyecto: Fase 0 en curso, bloqueo crítico resuelto"
status: active
date: 2026-09-27
tags:
  - estado
  - fase-0
related: []
---

## Fase actual

**Fase 0 — Cimientos, EN CURSO.** El bloqueo de `TASK-F0-02` está resuelto en su parte crítica:
el agujero de seguridad que estaba en `main` sin que lo supiéramos está cerrado y verificado,
y el método para no volver a caer está implementado. Queda trabajo funcional pendiente en
`TASK-F0-06`.

## Hecho y verificado

- **Memoria estructurada (MCP `camarero-memory`) operativa.** 13 herramientas, 95 tests
  propios en verde, 0 errores de integridad.
- **`TASK-F0-01` cerrada.** Repositorio público `github.com/proyectolibero/camarero` con
  AGPL, plantilla de PR, política de seguridad, pipeline (Biome + `tsc --strict` + Vitest +
  osv-scanner en tres jobs) y protección de rama. **0 vulnerabilidades.**
- **Esquema completo: 28 tablas** (migraciones 0002–0007), con restricciones verificadas y
  UUIDv7 propio porque PostgreSQL 17 no lo trae.
- **Aislamiento entre organizaciones funcionando** (0008–0010): 96 políticas,
  `FORCE ROW LEVEL SECURITY` en las 28 tablas, `audit_log` inmutable. Las 33 funciones de
  contexto están correctamente endurecidas y **respetan la RLS**.
- **`RISK-017` cerrado.** Un secuestro de ruta de búsqueda por tabla temporal permitía
  fijar una organización ajena en una sesión de mesa. Estaba en `main`. Arreglado en 0011 y
  verificado: con la función vieja la sesión quedaba con la organización del atacante, con
  la nueva queda con la real.
- **125 tests en verde, 0 omitidos** (95 del MCP + 30 de base de datos).
- **El método está corregido**, que es lo más importante de esta ronda: ver `ADR-0011`,
  `ADR-0012` y `LL-009`.

## Reglas que ahora se comprueban solas

Dos tests de **propiedad** que, si se rompen, avisan antes de llegar a `main`:

1. **Ninguna función `SECURITY DEFINER` sin endurecer**: sin `public` en su ruta de
   búsqueda y sin referencias `FROM`/`JOIN` sin cualificar.
2. **Ninguna política RLS con ciclo**: ninguna tabla se lee a sí misma, ni directa ni
   transitivamente (`ADR-0012`).

Los dos están **probados como capaces de detectar los fallos reales**: se ha verificado que
detectan un ciclo sintético y la función vulnerable, y que no dan falsos positivos en las 96
políticas que funcionan. Un test que no puede fallar no vale nada.

## Pendiente (TASK-F0-06)

1. **Los totales de la comanda no tienen protección.** Un comensal puede insertar una
   comanda con el descuento igual al bruto y el total queda en **0 CLP**. Diseño en
   `ADR-0008`.
2. **Dos correcciones de alcance** verificadas como necesarias: el cobro se imputa a quien
   lo registra, y un encargado sin local asignado alcanza su organización.
3. Ambas se reescriben **desde cero**, no parcheando las descartadas.

## Bloqueado

- `TASK-F0-04` y `TASK-F0-05` esperan a `TASK-F0-06`.
- `TASK-F1-01` espera a `TASK-F0-03` y `TASK-F0-04`.

## Método de trabajo (aprendido a golpes)

> Escribir un trozo, **verificarlo con una prueba ejecutada**, y solo entonces escribir el
> siguiente. No acumular código sin verificar.

Tres intentos fallidos seguidos vinieron de saltarse esto (`LL-009`). La regla de las
políticas es "cero ciclos" y **no** "cero subconsultas": durante un tiempo perseguí la
segunda, que era más costosa y no atacaba la causa (`ADR-0010`).

## Deuda conocida

- La protección de rama no bloquea los *pushes* directos del administrador.
- La protección no exige el check de Seguridad (hay 0 hallazgos: ya se puede endurecer).
- `pnpm test` exige Docker en la máquina de desarrollo.
- Todo el aislamiento depende de que las tablas conserven `FORCE ROW LEVEL SECURITY`; hay un
  test que lo cubre, pero conviene saberlo.
- El borde y el comensal comparten un único rol de base de datos: cualquier ejecución de SQL
  con ese rol podría fijar el contexto. No es alcanzable sin inyección, pero conviene
  separar capacidades.

## Decisiones pendientes

- **Nombre definitivo de producto y dominio.** No bloquea: se trabaja con el slug neutro
  `camarero`.
- **Figura legal** antes de cobrar la primera cuota. Afecta a `RISK-012`.
- **Cifras concretas de la cuota simbólica**, a fijar tras el primer piloto.
