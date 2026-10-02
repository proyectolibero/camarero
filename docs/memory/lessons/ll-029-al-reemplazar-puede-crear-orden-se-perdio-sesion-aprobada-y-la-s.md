---
id: LL-029
type: lesson
title: Al reemplazar puede_crear_orden se perdió sesion_aprobada y la suite de base lo cazó
status: recorded
date: 2026-10-02
tags:
  - migraciones
  - rls
  - seguridad
  - fase-3
related: []
---

## Error

La migración 0023 reescribió puede_crear_orden partiendo de la definición de 0009 y omitió la comprobación sesion_aprobada que había añadido 0018. Como consecuencia, un comensal sin aprobar podía crear comandas, y tres pruebas de packages/db (sala y afines) se pusieron en rojo con «antes: 1» en lugar de 0.

## Causa raiz

Se copió la versión antigua de la función en lugar de leer cuál era la definición vigente. `create or replace function` no avisa de lo que el reemplazo pierde: sustituye el cuerpo entero en silencio.

## Prevencion

Antes de reemplazar una función o una política, localizar TODAS sus definiciones previas (rg por el nombre en migrations/) y partir de la última, no de la primera. Los invariantes y las pruebas de base son la red: si al reemplazar sube el número de comandas permitidas, es que se ha perdido una barrera.
