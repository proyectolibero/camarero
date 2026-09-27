---
id: TASK-F0-05
type: task
title: "Copias de seguridad semanales cifradas y ensayo de restauracion"
status: todo
date: 2026-09-27
phase: F0
tags: [fase-0, operacion, respaldo]
related: [D-030, RISK-001]
acceptance:
  - "Un cron diario hace keep-alive de la base de datos y evita la pausa por inactividad"
  - "Un cron semanal genera pg_dump, lo cifra y lo sube a R2 con retencion de 4 copias semanales y 1 mensual"
  - "Existe un runbook de restauracion probado con un ensayo real"
depends_on: [TASK-F0-02]
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

Resolver la trampa de Supabase Free: sin backups automaticos y con pausa tras 7 dias de
inactividad. Un cron diario hace keep-alive; un cron semanal ejecuta `pg_dump --format=custom`,
lo cifra y lo sube a R2 con retencion de 4 copias semanales mas 1 mensual. Un backup nunca
probado no es un backup: el runbook de restauracion se ensaya de verdad.

## Aceptacion

- [ ] Un cron diario hace keep-alive de la base de datos y evita la pausa por inactividad
- [ ] Un cron semanal genera pg_dump, lo cifra y lo sube a R2 con retencion de 4 copias semanales y 1 mensual
- [ ] Existe un runbook de restauracion probado con un ensayo real
