---
id: overview
type: overview
title: overview — Vista general del sistema
status: active
date: 2026-09-30
tags:
  - mapa
related:
  - ADR-0001
  - ADR-0002
  - ADR-0003
  - ADR-0004
  - ADR-0005
  - ADR-0006
  - ADR-0007
  - ADR-0017
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - CONTRACT-pantallas
  - LL-011
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

- **Clientes:** cuatro superficies sobre el mismo dominio global (ver `CONTRACT-pantallas`
  y `ADR-0022`). Comensal en `app.camarero…/t/<codigo>` (publica y anonima), personal en
  `/staff` (KDS y toma de comanda), dueno en `/admin` y plataforma en `/panel`. Las dos
  ultimas las **dibuja el servidor**; las dos primeras son aplicaciones pequenas en el
  navegador sin dependencias de terceros (`ADR-0023`).
- **Borde:** Cloudflare Pages sirve los estaticos y Cloudflare Workers expone la API de
  borde: autenticacion, web push, cron, rate limit y validacion. Las fotos de carta viven
  en Cloudflare R2.
- **Datos:** Supabase. Postgres es la primera clase: la logica de negocio vive en
  disparadores y funciones **`SECURITY INVOKER`**, con RLS activada y probada en cada
  tabla, Auth para el personal y Realtime para las notificaciones. **Nunca `SECURITY
  DEFINER` sin endurecer**: un definer lee como su dueno y abre fuga entre organizaciones
  (`ADR-0017`, `LL-011`). La clave de servicio nunca llega al cliente ni al borde.
- **Sesion:** el pasaporte del personal vive en una cookie que el navegador no puede leer;
  el borde hace de intermediario en la entrada (`ADR-0024`).
- **Regla de dinero:** los importes son enteros de pesos chilenos (CLP). Nunca coma
  flotante, nunca `.toFixed()` para calcular. Ver `CONTRACT-dinero`.

## Modulos

- `apps/web` — PWA del comensal.
- `apps/staff` — PWA del personal: KDS y toma de comanda.
- `packages/ui` — piel compartida: tokens y componentes de presentacion.
- `packages/db` — migraciones SQL, RLS, funciones y semillas.
- `packages/domain` — logica pura: reparto de cuenta, totales, propinas, estados.
- `packages/i18n` — traducciones de UI (es/en).
- `packages/shared` — tipos, esquemas Zod y constantes.
- `workers/api` — Worker de borde: autenticacion, web push, cron, rate limit. **Aqui
  viven los paneles del dueno y de plataforma**, que se dibujan en el servidor
  (`workers/api/src/admin` y `workers/api/src/panel`). No hay aplicacion de cliente para
  ellos: seria una pieza mas que mantener sin ganar nada.
- `workers/backup` — copia cifrada de la base hacia R2.
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
