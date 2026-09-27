---
id: TASK-F0-03
type: task
title: "Desplegar Cloudflare Pages y Workers con endpoint de salud"
status: todo
date: 2026-09-27
phase: F0
tags: [fase-0, infraestructura, borde]
related: [ADR-0002]
acceptance:
  - "Pages sirve la PWA vacia en el dominio global y Workers expone /health"
  - "Existe un bucket R2 para imagenes de carta"
  - "El despliegue de produccion solo ocurre desde main tras CI verde"
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

Poner en pie el borde: Cloudflare Pages para los estaticos, Cloudflare Workers para la API
de borde (web push, cron, rate limit) y Cloudflare R2 para las imagenes de carta, todo bajo
el dominio global. El endpoint `/health` es la senal que consumen las alertas de
monitorizacion.

## Aceptacion

- [ ] Pages sirve la PWA vacia en el dominio global y Workers expone /health
- [ ] Existe un bucket R2 para imagenes de carta
- [ ] El despliegue de produccion solo ocurre desde main tras CI verde
