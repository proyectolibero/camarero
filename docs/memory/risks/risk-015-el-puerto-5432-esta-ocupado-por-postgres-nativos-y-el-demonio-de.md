---
id: RISK-015
type: risk
title: El puerto 5432 esta ocupado por Postgres nativos y el demonio de Docker no autoarranca
status: open
date: 2026-09-27
tags:
  - docker
  - postgres
  - entorno
  - fase-0
related: []
impact: medio
likelihood: alta
---

## Riesgo

La maquina de desarrollo tiene el puerto 5432 ocupado por dos servicios nativos de PostgreSQL (postgresql-x64-16 y postgresql-x64-18), ademas de un contenedor ajeno (locus-db, PostGIS, publicado en 55432). Por tanto el compose o el runner de tests NO puede publicar en 5432. Ademas, el demonio de Docker Desktop no arranca solo en esta maquina (el servicio com.docker.service esta en Manual/Stopped): hay que abrirlo antes de ejecutar los tests de base de datos. El runner debe fallar con un mensaje claro que diga "Docker Desktop no esta corriendo" en lugar de un error de conexion criptico.

## Evaluacion

- Probabilidad: alta
- Impacto: medio

## Mitigacion

Publicar la base de pruebas en un puerto libre (54322 o similar) y nunca en 5432. El runner de tests comprueba primero que el demonio responde y, si no, aborta con un mensaje explicito pidiendo arrancar Docker Desktop.
