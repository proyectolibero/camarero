---
id: state
type: state
title: "Estado actual del proyecto: Fase 0 en curso"
status: active
date: 2026-09-27
tags:
  - estado
  - fase-0
related: []
---

## Fase actual

**Fase 0 — Cimientos (semanas 1-2), EN CURSO.** Objetivo: repositorio, esquema de datos con
RLS, borde en Cloudflare y una integración continua verde antes de escribir producto.

## Hecho y verificado

- **Memoria estructurada (MCP `camarero-memory`) operativa y verificada con pruebas ejecutadas:**
  - `tsc --noEmit`: 0 errores.
  - `npm test`: **95 tests en verde**, 0 fallidos, 0 omitidos (8 ficheros, 2,1 s).
  - `docs/memory/`: **73 documentos, 0 errores y 0 avisos** de integridad.
  - El servidor arranca por stdio y está registrado en `opencode.json`; ya responde a las
    13 herramientas desde la sesión del agente.
- **Revisión de código y auditoría de seguridad completadas.** 10 hallazgos de seguridad y
  4 bugs de código, todos corregidos y **re-verificados con PoC ejecutados**:
  - El gate de rigor ya no se puede desactivar (ni por API ni por frontmatter) y no es
    fail-open ante un `requires` malformado.
  - Ningún mensaje que sale del servidor puede filtrar un secreto: se redacta en la frontera.
  - La frontera de escritura bloquea enlaces y junctions que apunten fuera de `docs/memory/`.
  - `doc_upsert` no deja duplicados huérfanos de singletons.
  - La inyección de instrucciones a través del contenido de la memoria está neutralizada
    con un token aleatorio por bloque y títulos aplanados.
- **Decisiones registradas:** 34 (D-001 … D-034) y 7 ADR.
- **Riesgos registrados:** 13, con su mitigación.
- **Lecciones registradas:** 3 — LL-001 (propiedades de parámetro en Node), LL-002 (un
  control que el llamante puede configurar no es un control), LL-003 (los mensajes de error
  de las librerías filtran el contenido que los provoca).
- **Contratos registrados:** 5 (dinero, estados de comanda, modelo de datos, protocolo de
  mesa, esquema de memoria).
- **Plan de ecosistema cerrado:** `PLAN.md`, `AGENTS.md` y la skill `camarero-memory`.

## En curso

- **`TASK-F0-01` — repositorio y pipeline de integración continua.** Es la única tarea
  accionable: las demás de la Fase 0 dependen de ella.

## Bloqueado

- **Dos criterios de `TASK-F0-01` dependen del humano**, no del agente: crear el
  repositorio remoto público en GitHub y activar la protección de rama. El trabajo local
  (monorepo, licencia, plantillas, pipeline) sí se puede completar sin ellos.

## Siguiente paso

1. Completar `TASK-F0-01` y cerrarla con la evidencia del pipeline en verde.
2. `TASK-F0-02` — esquema de base de datos con RLS y un test por tabla.
3. Convertir los PoC de la auditoría en tests de regresión permanentes del MCP.
4. Unificar la acentuación de los documentos de la memoria.

## Decisiones pendientes

- **Nombre definitivo de producto y dominio.** No bloquea: se trabaja con el slug neutro
  `camarero` y se renombra antes de los pilotos.
- **Figura legal** antes de cobrar la primera cuota. Afecta a RISK-012.
- **Cifras concretas de la cuota simbólica**, a fijar tras el primer piloto con datos reales.
