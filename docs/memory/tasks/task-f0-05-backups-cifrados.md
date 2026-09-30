---
id: TASK-F0-05
type: task
title: Copias de seguridad semanales cifradas y ensayo de restauracion
status: done
date: 2026-09-27
phase: F0
tags:
  - fase-0
  - operacion
  - respaldo
related:
  - D-030
  - RISK-001
acceptance:
  - Un cron diario hace keep-alive de la base de datos y evita la pausa por inactividad
  - Un cron semanal genera pg_dump, lo cifra y lo sube a R2 con retencion de 4 copias semanales y 1 mensual
  - Existe un runbook de restauracion probado con un ensayo real
depends_on:
  - TASK-F0-02
doc: contracts/contract-borde-contract-borde-el-borde-de-cloudflare-pages-workers-y-r2.md
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: true
  evidence: '2026-09-30 · pnpm test · workers/api 57 pasan, packages/db 53 pasan, tools/mcp-memory 95 pasan → 205 pasan, 0 fallan. pnpm typecheck 0; pnpm biome ci . 0. Workflow "Copias de seguridad" run 36763685381 en VERDE: volcado de 322342 bytes y copia cifrada de 322606 bytes subida a copias/semanal/2026-09-30.sql.age; ENSAYO DE RESTAURACION OK con 30 tablas en public y orgs/locations/staff/auth.users en 1=1 entre origen y restaurado, y aislamiento de 0 filas sin contexto en el restaurado. La copia es ilegible sin la clave: file la reconoce como "age encrypted file, X25519 recipient" y strings no encuentra el nombre de ningun local. El ensayo sabe fallar: con simular_fallo=true el run 36763558511 se puso ROJO con "pg_restore: error: could not read from input file: end of file". El keep-alive quedo desplegado y su disparador registrado en Cloudflare (crons 0 12 * * *), verificado por API: [{"cron":"0 12 * * *","created_on":"2026-09-30T19:02:22Z"}].'
---

## Descripcion

Resolver la trampa de Supabase Free: sin backups automaticos y con pausa tras 7 dias de
inactividad. Un cron diario hace keep-alive; un cron semanal ejecuta `pg_dump --format=custom`,
lo cifra y lo sube a R2 con retencion de 4 copias semanales mas 1 mensual. Un backup nunca
probado no es un backup: el runbook de restauracion se ensaya de verdad.

## Aceptacion

- [ ] Un cron diario hace keep-alive de la base de datos y evita la pausa por inactividad
- [ ] Un cron semanal genera pg_dump, lo cifra y lo sube a R2 con retencion de 4 copias semanales y 1 mensual
- [ ] Existe un runbook de restauracion probado con un ensayo real

## Notas

- **2026-09-30** — Cerrada. Tres criterios: (1) cron diario de keep-alive — HECHO, desplegado y registrado en Cloudflare, con la logica cubierta por 6 pruebas y los dos sondeos inyectables. OJO, no se ha observado un latido real: el cron lanzara a las 12:00 UTC y esa hora ya habia pasado. Queda pendiente mirar el primer latido. (2) cron semanal con pg_dump cifrado y retencion 4+1 — HECHO y ejecutado de verdad. (3) runbook de restauracion probado con un ensayo real — HECHO: el ensayo restaura y compara contra la base real, y se comprobo que sabe ponerse rojo. HUECO DECLARADO Y NO MAQUILLADO: el ensayo restaura en un PostgreSQL limpio, NO en un proyecto de Supabase nuevo (que ya trae su propio esquema auth y colisionaria al restaurar el archivo entero); esa parte del runbook queda marcada como NO ENSAYADA. Detalle que costo: el runner resolvia pg_dump 16 y Supabase corre 17; hubo que fijar la ruta explicita (LL-018). La clave privada de cifrado vive en los secretos de GitHub y en una copia fuera del repositorio, en la maquina del mantenedor.
