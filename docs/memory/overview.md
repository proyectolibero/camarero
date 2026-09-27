---
id: overview
type: overview
title: "Vista general del sistema"
status: active
date: 2026-09-27
tags: [mapa]
related: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007]
---

## Que es el sistema

Camarero es una plataforma tecnologica intermediaria para locales de hosteleria. Un
comensal escanea un QR o NFC en su mesa, abre una PWA sin instalar nada, se empareja con
la mesa **con aprobacion humana de personal del local**, ve la carta, envia su comanda
directa a cocina, sigue el estado de sus pedidos, llama a su mesero y pide la cuenta con
el reparto que elija. El cobro lo hace el personal en el TPV del local.

No somos una pasarela de pago: no procesamos dinero, no emitimos comprobantes y no
guardamos datos del comensal. La responsabilidad comercial, fiscal y sanitaria es siempre
del establecimiento.

## Arquitectura en texto

- **Clientes (PWA):** tres superficies sobre el mismo dominio global. Comensal en
  `app.dominio/t/<codigo>`, personal en `app.dominio/staff` (KDS + toma de comanda) y
  dueno en `app.dominio/admin`.
- **Borde:** Cloudflare Pages sirve los estaticos y Cloudflare Workers expone la API de
  borde: web push, cron, rate limit y validacion. Las fotos de carta viven en Cloudflare
  R2.
- **Datos:** Supabase. Postgres es la primera clase: la logica de negocio vive en
  funciones Postgres `SECURITY DEFINER`, con RLS activada y probada en cada tabla, Auth
  para el personal y Realtime para las notificaciones. La clave de servicio (role de
  servicio) nunca llega al cliente: solo existe como secreto en Workers.
- **Regla de dinero:** los importes son enteros de pesos chilenos (CLP). Nunca coma
  flotante, nunca `.toFixed()` para calcular. Ver `CONTRACT-dinero`.

## Modulos

- `apps/web` — PWA del comensal.
- `apps/staff` — PWA del personal: KDS y toma de comanda.
- `apps/admin` — panel web del dueno.
- `packages/ui` — design system (tokens, componentes, accesibilidad).
- `packages/db` — migraciones SQL, RLS, funciones y seeds.
- `packages/domain` — logica pura: reparto de cuenta, totales, propinas, estados.
- `packages/i18n` — traducciones de UI (es/en).
- `packages/shared` — tipos, esquemas Zod y constantes.
- `workers/api` — Worker de borde: web push, cron, rate limit.
- `workers/backup` — `pg_dump` cifrado hacia R2.
- `tools/mcp-memory` — el servidor MCP y el validador de esta memoria.
- `docs/memory` — la memoria estructurada del proyecto (este arbol).

## Cobertura de la memoria

| Ambito | Donde vive |
|--------|-----------|
| Arquitectura, decisiones, ADR, contratos, roadmap y estado | `docs/memory` (este arbol) |
| Reglas de trabajo para humanos y agentes | `docs/MEMORIA.md` y `AGENTS.md` |
| Codigo fuente | repositorio publico con licencia AGPL |
| Datos de producto: cartas, mesas, pedidos, personal y sesiones | Postgres (Supabase) |
| Imagenes de carta | Cloudflare R2 |
| Textos legales y de privacidad | paginas publicas del sitio |

Lo que **no** cubre esta memoria: no es la base de datos del producto, no almacena datos
de comensales, no contiene secretos ni credenciales, y no sustituye al codigo ni a los
tests. Aqui vive el **desarrollo**; los datos de producto viven en Postgres.

## Tipos de documento

| Tipo | Identificador | Proposito | Mutabilidad |
|------|---------------|-----------|-------------|
| `overview` | `overview` | Mapa del sistema (este documento) | mutable |
| `state` | `state` | Fase actual, bloqueos y siguiente paso | mutable |
| `roadmap` | `roadmap` | Fases, entregables y alcance | mutable |
| `conventions` | `conventions` | Reglas de codigo, testing, seguridad y git | mutable |
| `glossary` | `glossary` | Vocabulario ubicuo del proyecto | mutable |
| `adr` | `ADR-0001` ... | Decisiones de arquitectura | append-only |
| `decision` | `D-001` ... | Decisiones de producto y proceso | append-only |
| `task` | `TASK-F0-01` ... | Trabajo con criterios de aceptacion | mutable |
| `risk` | `RISK-001` ... | Riesgos con mitigacion | mutable |
| `question` | `OQ-001` ... | Preguntas abiertas al humano | mutable |
| `lesson` | `LL-001` ... | Errores y su prevencion | append-only |
| `contract` | `CONTRACT-*` | Contratos e invariantes del sistema | mutable |
| `log` | `log` | Bitacora cronologica | append-only |
