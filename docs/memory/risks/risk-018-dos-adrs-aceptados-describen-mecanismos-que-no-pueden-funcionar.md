---
id: RISK-018
type: risk
title: Dos ADRs aceptados describen mecanismos que no pueden funcionar como estan escritos
status: open
date: 2026-09-28
tags:
  - dinero
  - rls
  - bypassrls
  - arquitectura
  - fase-0
related: []
impact: alto
likelihood: alta
---

## Riesgo

Dos ADRs aceptados describen mecanismos que no pueden funcionar tal como estan escritos. (1) ADR-0008: dice que los importes de la comanda se derivan en un disparador BEFORE sobre la propia fila, pero orders_update solo permite el UPDATE al personal, asi que para el comensal el disparador nunca se ejecuta. Se aprobo sin comprobarlo. (2) ADR-0014: proponia cerrar los totales con un rol de servicio con BYPASSRLS, y la verificacion demostro que ese rol no queda acotado a una funcion: puede leer los order_items de TODAS las organizaciones y reescribir los totales de una comanda de OTRA organizacion pasandole su id, porque un SECURITY DEFINER necesita que su dueno tenga DML y el aislamiento por columna no es viable sin romper el disparador generico de updated_at. Ademas el EXECUTE se concede a PUBLIC por defecto: sin revoke explicito, el comensal podia llamar la funcion de cierre y con el BYPASSRLS del definer habria cerrado comandas ajenas. Probado antes y despues del revoke. Leccion transversal: la superficie de un rol de servicio no es la que se pretende, es la que resulta de los privilegios que la funcion necesita para funcionar.

## Evaluacion

- Probabilidad: alta
- Impacto: alto

## Mitigacion

No introducir BYPASSRLS hasta agotar alternativas. Alternativa que no se habia considerado: que el cierre de importes sea un efecto del propio flujo de estados, es decir, que la funcion que cambia la comanda de pendiente a aceptada (que ya la ejecuta el personal, y que es el momento natural en que los importes deben quedar fijados) sea la que recalcule los totales. Asi el personal que acepta la comanda es quien cierra los importes, no hace falta ningun rol con BYPASSRLS, y la regla de negocio es coherente: una comanda no esta lista para cocina hasta que alguien la acepta, y en ese momento queda valorada. Si se descarta esta via, entonces si hace falta ADR para el rol de servicio, con revoke execute from public obligatorio y un test que compruebe que camarero_app no puede ejecutar la funcion de cierre.
