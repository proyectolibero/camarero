---
id: ADR-0005
type: adr
title: "Sin paso de build: TypeScript nativo en Node mediante type stripping"
status: accepted
date: 2026-09-27
tags: [tooling, typescript, node]
related: []
---

## Contexto

El servidor de memoria se ejecuta en Node >= 22.18, que soporta ejecutar TypeScript
directamente con type stripping nativo. Un paso de build anade tiempo, artefactos y una
capa mas que un unico mantenedor debe mantener. Pero el type stripping solo borra tipos: no
transforma sintaxis que requiera generar codigo.

## Decision

No tener paso de build. Los ficheros `.ts` se ejecutan directamente con `node`. Para que
esto sea seguro, se activa `erasableSyntaxOnly: true` en `tsconfig.json`, de modo que
`tsc --noEmit` marque como error cualquier sintaxis no borrable antes de ejecutar.

Queda **prohibido** en codigo que Node ejecute directamente:

- propiedades de parametro (`constructor(private readonly x: T)`),
- `enum`,
- `namespace`.

Se sustituyen por un campo declarado, un objeto constante con `as const` y objetos planos,
respectivamente.

## Alternativas consideradas

- **Paso de build con `tsc`:** descartado por anadir tiempo, artefactos y una capa de
  mantenimiento sin aportar nada al objetivo.
- **`ts-node` o `tsx`:** descartados por introducir una dependencia de runtime que Node ya
  no necesita.
- **`esbuild` como transpilador rapido:** descartado por la misma razon: dependencia y
  configuracion extra.
- **Escribir JavaScript directamente:** descartado porque renuncia al tipado estricto.

## Consecuencias

- Arrancar el servidor es `node src/index.ts`, sin build previo.
- Hay que prescindir de sintaxis comoda de TypeScript; `erasableSyntaxOnly` lo hace
  verificable en lugar de confiar en la memoria.
- Esta restriccion ya provoco un fallo real al arrancar: ver `LL-001`.
