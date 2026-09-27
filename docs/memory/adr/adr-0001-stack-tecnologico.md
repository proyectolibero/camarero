---
id: ADR-0001
type: adr
title: "Stack tecnologico de punta a punta"
status: accepted
date: 2026-09-27
tags: [stack, arquitectura]
related: []
---

## Contexto

El proyecto lo mantiene una sola persona a tiempo completo y con presupuesto de operacion
cero. Necesita un cliente PWA, un borde con funciones de servidor (web push, cron, rate
limit) y una base de datos relacional con aislamiento por fila. Cambiar de lenguaje entre
capas multiplica el trabajo de un unico mantenedor.

## Decision

TypeScript de punta a punta en un monorepo gestionado con pnpm workspaces.

- **Lenguaje:** TypeScript en modo `strict`, modulos ESM.
- **Datos:** Supabase (Postgres + RLS + Auth + Realtime). La logica de negocio vive en
  funciones Postgres `SECURITY DEFINER`.
- **Borde:** Cloudflare Pages (estaticos) y Cloudflare Workers (API de borde). Imagenes en
  Cloudflare R2.
- **Tooling:** Biome (lint y formato), `tsc --strict`, Zod, Vitest, Playwright y Drizzle
  para migraciones tipadas (el SQL plano sigue siendo la fuente de verdad para RLS).

## Alternativas consideradas

- **Vercel en lugar de Cloudflare:** descartada porque el plan Hobby no admite uso
  comercial. Ver `ADR-0002`.
- **Backend en otro lenguaje (Go, Python, PHP):** descartada por duplicar el trabajo de un
  unico mantenedor y romper el tipado de punta a punta.
- **Firebase:** descartada por modelo NoSQL poco adecuado para dinero y relaciones, y por
  acoplamiento fuerte al proveedor.
- **JavaScript sin tipos:** descartada porque el tipado estricto es la red de seguridad de
  un proyecto de un solo mantenedor.
- **Servidor propio en VPS:** descartada por coste y carga operativa frente a los free
  tiers.

## Consecuencias

- Un solo lenguaje y un solo juego de herramientas: menos contexto que cambiar.
- El tipado estricto se vuelve obligatorio, no opcional.
- Dependemos de free tiers; el riesgo de proveedor unico se mitiga porque la capa de datos
  es Postgres estandar y migrar es un `pg_dump`.
- Exige dominar RLS y funciones Postgres, que es donde vive la logica de negocio.
