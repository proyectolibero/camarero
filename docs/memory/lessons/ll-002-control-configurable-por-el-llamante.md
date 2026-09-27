---
id: LL-002
type: lesson
title: "Un control que el llamante puede configurar no es un control"
status: recorded
date: 2026-09-27
tags: [seguridad, proceso, mcp]
related: []
---

## Error

El gate de rigor del MCP — el mecanismo que impide cerrar una tarea sin tests en verde —
se podia desactivar en dos llamadas:

```
task_create({ ..., requires_tests: false, requires_doc: false })
task_update({ id, status: "done" })        // se cierra sin tests, sin evidencia y sin documento
```

Y habia una segunda via, mas silenciosa: si el campo `requires` del frontmatter no era un
objeto valido (`requires: "x"`), el esquema fallaba al parsearlo y el gate **se saltaba
las comprobaciones en silencio**. El diseno era fail-open: un dato malformado desactivaba
el control en lugar de activarlo.

## Causa raiz

Se diseno el control como si el llamante fuese de fiar. Dos decisiones concretas lo
produjeron:

1. Exponer `requires_tests` y `requires_doc` como parametros de la herramienta. Eso
   convierte la configuracion del control en parte de la peticion que el control vigila.
2. Escribir la comprobacion como `if (requisitosValidos && requisitoActivo)`. Cuando la
   primera condicion es falsa, no se evalua nada y se pasa de largo. El camino del error
   era el camino permisivo.

## Prevencion

1. **Los controles no son configurables por quien los obedece.** Los requisitos del gate
   son constantes (`TASK_REQUIREMENTS`) y no existe ningun parametro para relajarlos.
2. **Fail-closed siempre.** Ante un dato ausente, invalido o ambiguo, se deniega. Y si
   alguien intenta desactivar el control, se reporta como error de integridad
   (`gate-no-configurable`) en lugar de ignorarlo.
3. **El gate se evalua por el estado resultante**, no por lo que pide la peticion. Antes
   solo se comprobaba `args.status === "done"`, asi que una actualizacion sin `status`
   dejaba una tarea cerrada con los tests en rojo.

## Detalle

Lo encontro el agente de auditoria de seguridad, no una revision de estilo. La leccion
general vale para todo el proyecto:

> Cuando disenes un control, preguntate quien puede apagarlo. Si la respuesta es "quien
> tiene que obedecerlo", no has disenado un control: has disenado una sugerencia.
