---
id: CONTRACT-esquema-memoria
type: contract
title: "Esquema y reglas de la memoria del proyecto"
status: active
date: 2026-09-27
tags: [memoria, mcp, contrato]
related: [ADR-0003, ADR-0004, ADR-0005, ADR-0007]
---

## Definicion

Un documento de memoria es un fichero markdown con frontmatter YAML obligatorio. Si un
documento no valida contra el esquema, no existe. La fuente de verdad son los ficheros
versionados en git; el MCP es el guardian y el indice.

## Tipos de documento

| Tipo | Identificador | Estados permitidos | Mutabilidad |
|------|---------------|--------------------|-------------|
| `adr` | `ADR-0001` ... | proposed, accepted, superseded, deprecated | append-only |
| `decision` | `D-001` ... | proposed, accepted, superseded, rejected | append-only |
| `task` | `TASK-F0-01` ... | todo, doing, blocked, review, done, cancelled | mutable |
| `risk` | `RISK-001` ... | open, mitigating, closed, accepted | mutable |
| `question` | `OQ-001` ... | open, answered, dropped | mutable |
| `lesson` | `LL-001` ... | recorded | append-only |
| `contract` | `CONTRACT-*` | draft, active, deprecated | mutable |
| `overview` | `overview` | active | mutable (unico) |
| `glossary` | `glossary` | active | mutable (unico) |
| `conventions` | `conventions` | active | mutable (unico) |
| `state` | `state` | active | mutable (unico) |
| `roadmap` | `roadmap` | active | mutable (unico) |
| `log` | `log` | append-only | append-only (unico) |

Cada tipo vive en su subcarpeta de `docs/memory` (`adr/`, `decisions/`, `tasks/`, `risks/`,
`questions/`, `lessons/`, `contracts/`), salvo los singletons y `log`.

## Invariantes

1. **Frontera de escritura unica:** el MCP solo escribe dentro de `docs/memory`. Un bug o un
   agente no puede tocar `apps/` ni ningun otro directorio.
2. **Append-only real:** ADR, decisiones, lecciones y bitacora nunca se reescriben; solo
   crecen. Para cambiar una decision se registra una nueva y la anterior se marca
   `superseded`.
3. **Guarda de secretos bloqueante:** el repositorio es publico (AGPL). Cualquier escritura
   con una clave, contrasena o cadena de conexion con credenciales se rechaza. Nunca se
   devuelve el valor detectado, solo una mascara.
4. **Sin indice persistente:** el indice se reconstruye en memoria. Si se corrompe, se borra
   y se regenera; la memoria nunca queda irrecuperable.
5. **Toda decision aceptada declara alternativas descartadas.** Sin alternativas no hay
   decision, solo una preferencia.
6. **Alcance explicito:** aqui vive el desarrollo; los datos de producto viven en Postgres.

## Gate de rigor

Cerrar una tarea es un examen. `task_update` con `status: "done"` se rechaza si falta alguno
de estos: criterios de aceptacion, tests en verde (`tests.passed: true`), evidencia
(`tests.evidence` con comando y resultado), documento asociado existente (`doc`) o
dependencias cerradas (`depends_on`). Ver `ADR-0007`.

## Herramientas

- Lectura: `memory_overview`, `memory_context`, `memory_search`, `memory_get`,
  `memory_next`, `memory_validate`, `memory_ping`.
- Escritura: `adr_create`, `decision_record`, `task_create`, `task_update`,
  `record_append`, `doc_upsert`.

La documentacion para humanos no vive en `docs/memory`: vive en `docs/MEMORIA.md` y en
`tools/mcp-memory/README.md`. Todo `.md` dentro de `docs/memory` debe llevar frontmatter.
