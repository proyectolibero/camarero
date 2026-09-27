---
id: ADR-0007
type: adr
title: "Gate de rigor bloqueante para cerrar tareas"
status: accepted
date: 2026-09-27
tags: [proceso, memoria, calidad]
related: []
---

## Contexto

El proyecto trabaja con un flujo de arquitecto mas agentes, con un unico mantenedor.
Declarar una tarea "terminada" a mano es una intencion, no un hecho: sin un control
automatico, se cierran tareas sin tests, sin documentacion o con dependencias abiertas, y
el desvio se descubre tarde.

## Decision

Cerrar una tarea (`status: "done"`) es un **examen bloqueante**. El MCP rechaza el cierre si
no se cumplen todas estas condiciones:

1. La tarea declara criterios de aceptacion (al menos uno).
2. Los tests constan en verde (`tests.passed: true`).
3. Existe la evidencia (`tests.evidence`) con fecha, comando y resumen del resultado.
4. Existe el documento asociado (`doc`) apuntando a un fichero real de la memoria.
5. Todas las dependencias (`depends_on`) estan cerradas.

## Alternativas consideradas

- **Confiar en la disciplina del mantenedor:** descartada porque es exactamente lo que
  falla cuando hay prisa.
- **Checklist manual fuera del sistema:** descartada porque no se puede verificar ni
  bloquear.
- **Gate unicamente en el pipeline de CI:** descartado porque el CI no conoce la
  documentacion asociada ni el estado de las dependencias de la memoria.
- **Revision humana de cada cierre:** descartada porque con un solo mantenedor no hay un
  segundo par de ojos y no escala.

## Consecuencias

- "Maximo rigor" pasa de intencion a hecho verificable por la herramienta.
- Una tarea no puede cerrarse "casi": o cumple las cinco condiciones o se queda abierta.
- Obliga a registrar evidencia real (comando y resultado), no una afirmacion.
