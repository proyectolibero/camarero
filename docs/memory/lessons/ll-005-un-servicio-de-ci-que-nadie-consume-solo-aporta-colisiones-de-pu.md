---
id: LL-005
type: lesson
title: Un servicio de CI que nadie consume solo aporta colisiones de puerto
status: recorded
date: 2026-09-27
tags:
  - ci
  - docker
  - infraestructura
  - falso-supuesto
related: []
---

## Error

La CI habria quedado en rojo por un conflicto de puerto entre un servicio de PostgreSQL declarado en el workflow y el contenedor efimero que levantan los propios tests, ambos publicando en 54322. El servicio no lo usaba nadie: era ruido con efectos secundarios.

## Causa raiz

Se anadio el servicio postgres a la CI por inercia — parece la forma canonica de dar una base de datos a los tests en GitHub Actions — sin comprobar que el runner de packages/db ya levanta su propio contenedor. GitHub publica los puertos de los servicios en el host del runner, que es el mismo host donde corren los pasos: declarar el 54322 en el servicio y volver a publicarlo desde el contenedor efimero es un conflicto de binding garantizado.

## Prevencion

Antes de anadir un servicio de infraestructura a la CI, comprobar que algun consumidor real lo usa y en que puerto. Si los tests levantan sus propias dependencias, el servicio es ruido que ademas puede colisionar. Regla practica: en el pipeline, o el servicio lo consume el codigo, o no se declara.

## Detalle

Se añadió un bloque `services: postgres` a `.github/workflows/ci.yml` publicando en `54322`, y ese mismo puerto es el que usa `packages/db` para su contenedor efímero. GitHub Actions publica los puertos de los `services` en el host del runner, y los pasos del job corren en ese mismo host: el segundo binding falla con "port is already allocated" y la CI queda en rojo. Lo grave no es el error, es que el servicio no servía para nada: no existía ninguna ruta de código que se conectara a él. Se añadió por costumbre, no por necesidad. Detectado por el agente de verificación antes de llegar a main; corregido eliminando el bloque y añadiendo un paso de limpieza de contenedores huérfanos.
