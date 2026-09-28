---
id: LL-010
type: lesson
title: Un acento grave dentro de un template literal desconecto el test de invariantes sin avisar
status: recorded
date: 2026-09-28
tags:
  - typescript
  - testing
  - herramientas
  - fase-0
related: []
---

## Error

El fichero packages/db/tests/invariantes.test.ts dejaba de compilar con [PARSE_ERROR] Expected a semicolon, y el test de invariantes ampliado no se ejecutaba. La red de seguridad estaba desconectada sin que nada avisara: los tests aparecian como fallidos de transformacion, no como fallo de la propiedad que comprueban.

## Causa raiz

Dentro de un template literal de TypeScript que contiene una consulta SQL, escribi un comentario SQL con la palabra public. entre acentos graves. El acento grave cerro el template literal y el fichero de test dejo de compilar: 0 tests ejecutados, con un error de parseo que no tiene nada que ver con el SQL. Es la tercera vez en la sesion que un caracter de formato rompe un proceso: PowerShell anade BOM con Set-Content (LL-006), y ahora el backtick dentro de template literal.

## Prevencion

Nunca usar acentos graves dentro de un template literal de TypeScript, ni en comentarios SQL ni en documentacion embebida. Si hace falta citar un nombre de objeto, usar comillas simples o nombrarlo sin simbolos. Regla general: antes de dar por buena una ejecucion, comprobar que la suite ejecuta el numero de tests esperado, no solo que no hay rojos; un fichero que no compila pasa desapercibido si uno solo mira el resumen. Tercera leccion de la misma familia (LL-006, LL-010): un caracter invisible o delimitador rompe mas que un error de logica.
