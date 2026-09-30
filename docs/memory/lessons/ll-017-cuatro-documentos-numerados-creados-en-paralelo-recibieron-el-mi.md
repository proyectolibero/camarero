---
id: LL-017
type: lesson
title: Cuatro documentos numerados creados en paralelo recibieron el mismo numero
status: recorded
date: 2026-09-30
tags:
  - memoria
  - mcp
  - proceso
  - integracion
related: []
---

## Error

Se crearon cuatro decisiones de arquitectura en paralelo y tres de ellas recibieron el mismo identificador (ADR-0023), dejando la memoria con identificadores duplicados y referencias rotas.

## Causa raiz

El MCP calcula el numero siguiente leyendo los documentos que ya existen. Cuatro llamadas de creacion lanzadas a la vez leyeron el mismo estado y a las cuatro les toco el 0023. El error no fue de la herramienta al escribir, sino de pedirle cuatro numeraciones simultaneas.

## Prevencion

Los documentos numerados (ADR, decisiones, tareas, lecciones) se crean DE UNO EN UNO, nunca en paralelo: el numero se asigna leyendo el estado de la carpeta y dos lectura simultaneas ven lo mismo. Si alguna vez conviene crear varios, primero se crea uno y despues los demas. Mejora pendiente para el MCP: serializar la asignacion de numeros, de modo que la herramienta no permita dos altas simultaneas del mismo tipo.

## Detalle

Se crearon ADR-0022, ADR-0023 (el panel se dibuja en el servidor), ADR-0023 (la sesion en cookie) y ADR-0023 (el panel de plataforma) en una sola tanda paralela. Resultado: tres documentos con el mismo identificador y diez errores de integridad, ademas de referencias rotas a ADR-0024 y ADR-0025, que no llegaron a existir porque nadie los creo con esos numeros. Se reparo renumerando dos de los tres (0023 se quedo con el que ya encajaba con las referencias existentes, el de la sesion paso a 0024 y el de plataforma a 0025) corrigiendo el identificador del frontmatter y renombrando los ficheros. Ninguna decision se reescribio: solo se corrigio el numero. Validacion posterior: 0 errores.
