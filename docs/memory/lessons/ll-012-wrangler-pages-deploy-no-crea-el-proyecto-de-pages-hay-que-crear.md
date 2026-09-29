---
id: LL-012
type: lesson
title: "wrangler pages deploy no crea el proyecto de Pages: hay que crearlo antes"
status: recorded
date: 2026-09-29
tags:
  - cloudflare
  - despliegue
  - herramientas
  - fase-0
related: []
---

## Error

El workflow de Despliegue fallo en el paso de Pages con 'The Pages project "camarero" does not exist. Maybe you intended to deploy a Worker project instead?'. El paso de la API quedo omitido, asi que no se publico nada en el primer intento.

## Causa raiz

Asumi que `wrangler pages deploy --project-name camarero` crearia el proyecto de Pages si no existia, como hacen otras herramientas. No lo hace: el primer despliegue fallo con 'The Pages project "camarero" does not exist'. Es la misma familia de error que LL-009 y LL-011: suponer el comportamiento de una herramienta en lugar de comprobarlo. La diferencia es que esta vez costo un run rojo, no un rediseno.

## Prevencion

Provisionar el recurso de forma explicita antes de usarlo: en el pipeline se anadio un paso `wrangler pages project create camarero --production-branch main` tolerante a que ya exista. Regla general: un despliegue no debe dar por hecho que el recurso destino se crea solo; si el proveedor no lo documenta como auto-creado, se crea antes. Y comprobar el comportamiento de una herramienta con una ejecucion real, no por lo que uno supone que hace.
