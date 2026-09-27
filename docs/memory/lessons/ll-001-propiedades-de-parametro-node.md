---
id: LL-001
type: lesson
title: "Node rechaza las propiedades de parametro al ejecutar TypeScript directamente"
status: recorded
date: 2026-09-27
tags: [typescript, node, tooling, mcp]
related: []
---

## Error

El servidor MCP no arrancaba. `node src/index.ts` terminaba de inmediato con:

```
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not
supported in strip-only mode
  at file:///.../src/core/store.ts:73
    constructor(private readonly root: string = memoryRoot()) {}
```

## Causa raiz

La sintaxis de propiedad de parametro (`constructor(private readonly x: T)`) no es
"erasable": para ejecutarla hay que generar codigo, y el type stripping de Node solo
borra tipos. No es un fallo de Node ni del SDK: es una incompatibilidad entre una
comodidad de TypeScript y el modelo de ejecucion que elegimos para no tener paso de
build (ADR-0005).

## Prevencion

1. `erasableSyntaxOnly: true` en `tsconfig.json` (ya activo): hace que `tsc --noEmit`
   marque esta sintaxis antes de ejecutar nada.
2. Prohibido en codigo que Node ejecute directamente: propiedades de parametro, `enum`
   y `namespace`. Se sustituyen por campo declarado, objeto constante con `as const`, y
   objetos planos.
3. La linea de `store.ts` donde esta prohibido lleva un comentario explicando por que.

## Detalle

El typecheck de la primera version ya tenia 19 errores, pero la sesion que escribio el
codigo no disponia de terminal, asi que el defecto llego intacto hasta la verificacion
delegada. La leccion de proceso es mas importante que la tecnica:

> **Nada se declara terminado si no se ha ejecutado.** El typecheck no sustituye al
> arranque real, y "he escrito los tests" no es "los tests pasan".

Por eso este proyecto separa el trabajo en dos roles: quien construye y quien verifica
con el comando en la mano. La verificacion de esta memoria, de hecho, la encontro.
