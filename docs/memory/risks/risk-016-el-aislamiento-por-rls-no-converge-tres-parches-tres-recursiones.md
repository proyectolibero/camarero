---
id: RISK-016
type: risk
title: "El aislamiento por RLS no converge: tres parches, tres recursiones, y un agujero de importes abierto"
status: open
date: 2026-09-27
tags:
  - rls
  - postgres
  - dinero
  - fase-0
  - bloqueo
related: []
impact: alto
likelihood: alta
---

## Riesgo

Las migraciones 0011 y 0012 no cierran la integridad de importes. Verificacion con pruebas ejecutadas: (1) el camino del comensal esta ROTO por recursion infinita nueva (locations -> en_mi_local_comensal -> table_sessions -> en_mi_local -> org_del_local -> locations), asi que un comensal no puede leer la carta, insertar lineas ni cerrar la comanda: errores de stack depth exceeded en todas las operaciones; (2) la reescritura de 0011 elimino el disparador que protegia los totales de la comanda, asi que ahora se puede insertar una comanda con discount_clp igual al bruto y el total queda en 0; (3) la suite paso de 123 tests en verde a 99 en verde y 24 omitidos, porque rls.test.ts no arranca; (4) la nueva politica de checkouts_insert perdio la comprobacion de organizacion: un cobrador de la organizacion A puede escribir un cobro apuntando a una sesion de la organizacion B. Lo que SI funciona: el guardian de precio de linea y de delta de modificador rechaza los valores que no coinciden con la carta (probado: 'El precio enviado (1) no coincide con el de la carta (10000)'), el cobro a nombre de otro se rechaza, el encargado sin local alcanza su organizacion y el camarero sin local falla cerrado.

## Evaluacion

- Probabilidad: alta
- Impacto: alto

## Mitigacion

No seguir parcheando funcion a funcion. Redisenar el alcance: (A) desnormalizar org_id y location_id en las tablas que hoy llegan a ellos por join, de modo que toda politica se resuelva con una comparacion de columnas y CERO subconsultas, o (B) pasar el contexto del actor completo (org, local y sesion) en el propio ajuste de sesion, de modo que las politicas no tengan que derivarlo leyendo tablas. La opcion A es la que menos depende de que el borde se comporte bien. Antes de elegir, decidir tambien donde vive el calculo de totales y descuentos de la comanda, que hoy no tiene ninguna proteccion en la base de datos.
