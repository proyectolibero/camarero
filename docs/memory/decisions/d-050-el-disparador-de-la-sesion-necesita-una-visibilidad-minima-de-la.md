---
id: D-050
type: decision
title: El disparador de la sesion necesita una visibilidad minima de la localidad por contexto
status: accepted
date: 2026-10-01
phase: F1
tags:
  - rls
  - comensal
  - localidad
  - fase-1
related:
  - ADR-0031
  - LL-022
  - TASK-F1-06
  - RISK-016
---

## Decision

Anadir una politica de solo lectura en `locations` que deje ver el local cuyo id viene en `app.location_id`, solo para el comensal anonimo y solo antes de que tenga sesion. Es lo que permite al disparador `camarero_completar_org_sesion`, que ahora deriva la localidad de la mesa, leer el local y derivar la organizacion bajo FORCE RLS sin BYPASSRLS. La politica lee SOLO contexto, no cierra ningun ciclo, y no da acceso a la carta ajena porque la carta del comensal se resuelve por la SESION, no por `app.location_id`.

## Justificacion

Bajo FORCE ROW LEVEL SECURITY el propietario del esquema tambien queda sujeto a las politicas (verificado en el contenedor: un definer del propietario lee 0 filas de locations sin contexto). El disparador es SECURITY DEFINER, asi que no puede leer el local de la mesa sin una via de contexto. ADR-0031 exige que las cerraduras lean solo contexto; esta pieza respeta esa regla.

## Alternativas

1) Funcion SECURITY DEFINER que lea locations como su dueno: imposible bajo FORCE RLS sin quitar el FORCE o dar BYPASSRLS, y ADR-0017/0015 quitaron justo eso. 2) Politica de locations que lea la tabla tables por el codigo: abre un ciclo de politicas (locations -> tables -> locations via ve_local_personal/org_del_local), que el invariante de cero ciclos rechaza. 3) Que el borde leyera la organizacion por su cuenta: no puede, mismo problema de visibilidad. 4) Denormalizar org_id en tables: cambio de esquema mayor, no pedido.
