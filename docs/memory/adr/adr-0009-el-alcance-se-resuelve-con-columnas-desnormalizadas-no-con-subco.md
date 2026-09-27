---
id: ADR-0009
type: adr
title: El alcance se resuelve con columnas desnormalizadas, no con subconsultas entre tablas
status: proposed
date: 2026-09-27
tags:
  - rls
  - postgres
  - aislamiento
  - arquitectura
related:
  - RISK-016
  - LL-004
  - LL-007
  - LL-008
  - CONTRACT-modelo-datos
---

## Contexto

Tres intentos de implementar el aislamiento por RLS fracasaron, cada uno con una recursion distinta: locations → en_mi_local → locations; locations → org_del_local → locations; y locations → en_mi_local_comensal → table_sessions → en_mi_local → locations. El patron comun es resolver el alcance con funciones que LEEN tablas, mientras las tablas que leen estan protegidas por FORCE ROW LEVEL SECURITY. Con 28 tablas, cualquier camino entre dos de ellas cierra el circulo. El tercer intento dejo ademas el camino del comensal inservible y perdio la proteccion de los totales de la comanda, que es peor que no haber empezado.

## Decision

Toda tabla lleva org_id y location_id como columnas propias, desnormalizadas si hace falta, y ninguna politica RLS contiene subconsultas a otra tabla protegida: todas se resuelven comparando esas columnas con el contexto del actor.

## Alternativas consideradas

(A) Rediseñar las politicas para que no se llamen entre si, sin cambiar el esquema. Se intento tres veces y fracaso: con 28 tablas y FORCE RLS en todas, cualquier camino entre dos tablas cierra el circulo, y hay caminos que el producto necesita (el comensal tiene que ver la carta de SU local, y su local se conoce por su sesion). (B) Pasar todo el contexto del actor al abrir la sesion, de modo que las politicas solo comparen valores. Deja el aislamiento en manos del borde: si el borde se equivoca o alguien llama a la API directamente, el aislamiento se cae. Es exactamente el patron que este proyecto rechazo para el precio. (C) Denormalizar org_id y location_id en las tablas que hoy los alcanzan por join. Elegida.

## Consecuencias

Gana: las politicas pasan a ser comparaciones de columnas, sin subconsultas entre tablas protegidas, y desaparece la clase entera de fallo (tres intentos, tres recursiones distintas). El aislamiento deja de depender de que el borde fije bien el contexto. Ademas el coste por consulta baja, porque comparar una columna es mas barato que resolver un join. Pierde: hay que anadir y mantener dos columnas desnormalizadas en unas veinte tablas, y si un registro se mueve de local hay que actualizar sus descendientes. Eso ultimo se asume con una regla: un local no se mueve de organizacion, y mover una mesa de local es una operacion de configuracion que se hace con las mesas cerradas. El riesgo real es que un dato desnormalizado se quede obsoleto, y se mitiga con una restriccion: la columna desnormalizada debe coincidir con la del padre, comprobada por una clave foranea compuesta o un disparador BEFORE de la propia fila (ADR-0008).
