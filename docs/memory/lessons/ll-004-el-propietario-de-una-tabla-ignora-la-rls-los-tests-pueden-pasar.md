---
id: LL-004
type: lesson
title: "El propietario de una tabla ignora la RLS: los tests pueden pasar sin probar nada"
status: recorded
date: 2026-09-27
tags:
  - postgres
  - rls
  - testing
  - falso-positivo
related: []
---

## Error

Un test de RLS que se conecta como propietario de la tabla pasa siempre, porque el propietario no esta sujeto a las politicas. La suite quedo en verde con la RLS efectivamente desactivada.

## Causa raiz

PostgreSQL exime al propietario de una tabla de sus politicas RLS por diseno, y los roles que aplican migraciones son propietarios. Se asumio que "habilitar RLS" era suficiente para que las politicas se aplicaran al ejecutar los tests.

## Prevencion

Los tests de RLS se ejecutan siempre con un rol de aplicacion no propietario. El propio test comprueba que el rol de test no es propietario ni tiene BYPASSRLS, y que ninguna tabla tiene FORCE ROW LEVEL SECURITY apagado. Y se comprueba que el test falla al quitar una politica antes de dar por buena la suite.

## Detalle

En PostgreSQL, el propietario de una tabla ignora sus politicas RLS salvo que se le aplique FORCE ROW LEVEL SECURITY. Si los tests de RLS se conectan con el rol que aplica las migraciones (el propietario), la RLS parece funcionar y no se esta probando nada: todos los tests pasarian siempre, incluido el que deberia detectar una politica ausente. Es un falso positivo perfecto y habria invalidado los tres criterios de aceptacion de TASK-F0-02 sin que nadie lo notara. Mitigacion adoptada: (1) los tests se conectan con un rol de aplicacion NO propietario y sin BYPASSRLS; (2) el test que recorre todas las tablas comprueba que ninguna tiene FORCE ROW LEVEL SECURITY desactivada; (3) se verifica a mano que el test falla de verdad al quitar una politica. Evidencia: con el rol propietario, select count(*) devolvio 2 filas de dos organizaciones distintas; con un rol no propietario, devolvio 1.
