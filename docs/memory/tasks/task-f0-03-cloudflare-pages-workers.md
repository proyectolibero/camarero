---
id: TASK-F0-03
type: task
title: Desplegar Cloudflare Pages y Workers con endpoint de salud
status: done
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
doc: contracts/contract-borde-contract-borde-el-borde-de-cloudflare-pages-workers-y-r2.md
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: true
  evidence: '2026-09-30 · Dominio propio en pie, comprobado en vivo: GET https://camarero.proyectolibero.org/admin devuelve 200 text/html con el formulario de entrada (y «Contraseña» con eñe), y GET https://camarero.proyectoliberio.org/health devuelve 200 {"estado":"ok","servicio":"camarero-api","version":"0.0.0"}. El bucket R2 camarero-cartas existe. El despliegue solo ocurre desde main tras CI verde (deploy.yml con workflow_run, conclusion success, event push y head_branch main). ADR-0027 cambio el reparto: el host lo sirve el Worker con los estaticos dentro, y el proyecto Pages se retiro (Pages y Worker no pueden compartir nombre de host, verificado en la documentacion oficial).'
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

- **2026-09-30** — Cerrada. Los tres criterios: (1) la web se sirve y el Worker expone /health — CUMPLIDO, y mejor de lo pedido: las dos cosas en el MISMO nombre de host (ADR-0027), que era la unica forma soportada por Cloudflare de tener un solo dominio con estaticos y rutas dinamicas juntas; (2) bucket R2 camarero-cartas — HECHO (y ademas se creo camarero-copias para las copias); (3) despliegue solo desde main tras CI verde — HECHO. El dominio lo conecto el humano porque el token de despliegue NO tiene permiso de DNS (403): es tu dominio y el clic es tuyo. Lo que queda abierto de esta tarea es la limpieza: el proyecto Pages sigue existiendo aunque ya no se publica en el, y conviene borrarlo cuando el nuevo montaje lleve un tiempo estable.
