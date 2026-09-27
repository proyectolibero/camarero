# Proyecto Camarero

Garzon virtual para locales de hosteleria: el comensal escanea un QR en su mesa, pide
directo a cocina y pide la cuenta, y un empleado la cobra en el TPV del local.

## La promesa central

- **No somos una pasarela de pago.** No procesamos dinero, no emitimos comprobantes y no
  tocamos datos de pago. El local cobra en su propio TPV.
- **No guardamos datos del comensal.** Alias de mesa y un token opaco: sin nombre, sin
  telefono, sin historial. Cada visita empieza de cero.
- **No somos empleados del local.** Somos una plataforma tecnologica intermediaria. La
  responsabilidad de precios, alergenos, tiempos y calidad es siempre del establecimiento.

## Estado

**Fase 0 — Cimientos (en curso).** El objetivo de esta fase es dejar el repositorio, el
esquema de datos con RLS, el borde en Cloudflare y una integracion continua verde antes de
escribir producto. Consulta `docs/memory/state.md` para el estado exacto.

## Como se trabaja

Este proyecto usa un flujo de **arquitecto + agentes** con la **memoria como contrato**:

1. El arquitecto decide y produce un briefing con `memory_context`.
2. Los agentes ejecutan el briefing; no deciden arquitectura.
3. Nada se acepta sin tests en verde y con evidencia registrada.
4. Cada decision, riesgo o error queda en la memoria del proyecto.

La memoria vive en `docs/memory/` (markdown versionado en git) y se consulta a traves del
MCP `camarero-memory`. Lee `docs/MEMORIA.md` y `AGENTS.md` antes de tocar nada.

## Arranque

Requisitos: **Node >= 22.18** (el `.nvmrc` fija 24) y **pnpm** via corepack.

```bash
corepack enable      # deja disponible la version de pnpm fijada en package.json
pnpm install
pnpm check           # lint + typecheck + tests
```

Comandos utiles:

| Comando | Que hace |
|---------|----------|
| `pnpm lint` | Biome sobre todo el repositorio |
| `pnpm format` | Aplica el formato de Biome |
| `pnpm typecheck` | `tsc --noEmit` en cada paquete |
| `pnpm test` | Vitest en cada paquete |
| `pnpm check` | Los tres anteriores en cadena |

### La memoria del proyecto

La memoria es un servidor MCP ya construido en `tools/mcp-memory/`. Se registra en
`opencode.json` y se usa durante la sesion del agente: `memory_overview` al empezar,
`memory_context` antes de escribir codigo y `task_update` para cerrar una tarea. Sus tests
(`pnpm -r run test`) forman parte de la suite del monorepo.

## Estructura

```
apps/       PWA del comensal, del empleado y panel del dueno (aun sin codigo)
packages/   paquetes compartidos; domain acogera la logica pura de dinero y reparto
workers/    Workers de Cloudflare (API, push, backups)
tools/      herramientas internas; aqui vive el MCP de memoria
docs/       documentacion y memoria del proyecto
```

## Licencia

AGPL-3.0-or-later. Ver `LICENSE`. El codigo es publico y se puede autohospedar; el
compromiso es que nadie quede atrapado en la plataforma.
