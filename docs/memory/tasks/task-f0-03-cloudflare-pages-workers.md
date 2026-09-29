---
id: TASK-F0-03
type: task
title: Desplegar Cloudflare Pages y Workers con endpoint de salud
status: doing
date: 2026-09-27
phase: F0
tags:
  - fase-0
  - infraestructura
  - borde
related:
  - ADR-0002
acceptance:
  - Pages sirve la PWA vacia en el dominio global y Workers expone /health
  - Existe un bucket R2 para imagenes de carta
  - El despliegue de produccion solo ocurre desde main tras CI verde
depends_on:
  - TASK-F0-01
doc: null
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: false
  evidence: null
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

## Notas

- **2026-09-28** — EN CURSO: construido y verificado en local; falta el despliegue real, que depende de la cuenta de Cloudflare del mantenedor. Hecho: Worker @camarero/api con /health (funciones puras sobre Request/Response, 5 tests), web en apps/web (index, manifest, icono, estilos, cabeceras de seguridad en _headers), wrangler.jsonc con binding R2 a camarero-cartas, y .github/workflows/deploy.yml que solo publica desde main y solo si CI paso (workflow_run + conclusion success + event push + head_branch main). Verificado: pnpm test 142 en verde (5 api + 42 db + 95 mcp), typecheck 0, biome 0, wrangler deploy --dry-run compila y reconoce el binding R2. ADR-0018 (wrangler empaqueta el borde) y CONTRACT-borde (diseno y pasos manuales). PENDIENTE para cerrar: (1) crear el bucket R2 camarero-cartas; (2) crear el token de API con permiso minimo y guardarlo como secreto CLOUDFLARE_API_TOKEN, con CLOUDFLARE_ACCOUNT_ID; (3) publicar y comprobar que Pages sirve la web y el Worker responde /health en el dominio; (4) conectar camarero.proyectolibero.org y camarero-api.proyectolibero.org. El codigo NO se ha publicado a proposito: sin los secretos, el workflow de Despliegue daria rojo en main.
