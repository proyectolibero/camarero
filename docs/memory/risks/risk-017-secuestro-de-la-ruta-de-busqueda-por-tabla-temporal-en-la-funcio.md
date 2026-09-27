---
id: RISK-017
type: risk
title: Secuestro de la ruta de busqueda por tabla temporal en la funcion de sesiones de 0008
status: open
date: 2026-09-27
tags:
  - seguridad
  - search-path
  - search-path-temporal
  - rls
  - critico
related: []
impact: alto
likelihood: alta
---

## Riesgo

Auditoria de seguridad del aislamiento. CRITICO confirmado con prueba ejecutada: camarero_completar_org_sesion() en 0008_sesiones_con_org.sql linea 43 usa 'from locations l' sin cualificar, y su search_path es 'pg_catalog, public'. Un llamante con privilegio TEMP crea una tabla temporal llamada locations, le concede lectura al propietario de la funcion, y consigue que el disparador lea SU tabla en lugar de public.locations: se fija asi un org_id arbitrario en una sesion de mesa. Prueba literal: org_id_resultante=22222222-... (la organizacion B, cuando el local era de la A). Consecuencia en cadena: desde esa sesion, org_de_sesion() devuelve B y puede_crear_orden() acepta comandas con organizacion ajena, y el dueno de B pasa a ver sesiones y comandas de un local que no es suyo. Se arregla cualificando public.locations y dejando el search_path solo en pg_catalog, como ya hacen las otras 33 funciones. Hallazgos adicionales: (ALTO) todo el aislamiento depende de que las tablas conserven FORCE ROW LEVEL SECURITY, y quitar el FORCE de una tabla convierte las funciones en una fuga directa, probado; hay un test que lo cubre. (ALTO) la autorizacion se apoya en parametros de sesion que el propio llamante puede fijar, y el borde y el comensal comparten un unico rol, asi que cualquier ejecucion de SQL con ese rol escala a administrador de plataforma; no es alcanzable sin inyeccion, pero conviene separar capacidades. (MEDIO) EXECUTE se concede a PUBLIC por defecto y no se revoca. (BAJO) el comentario del generador dice 74 bits aleatorios y son 72, sin impacto. Lo tranquilizador: un comensal NO puede leer datos de otra sesion llamando a las funciones con un UUID adivinado, devuelve NULL, y la enumeracion es inviable.

## Evaluacion

- Probabilidad: alta
- Impacto: alto

## Mitigacion

Cualificar public.locations y reducir el search_path a pg_catalog en camarero_completar_org_sesion() (una linea). Anadir un test invariante que recorra todas las funciones SECURITY DEFINER y falle si alguna tiene public en su configuracion o contiene una referencia FROM/JOIN sin cualificar. Revocar EXECUTE de PUBLIC y concederlo de forma explicita por capacidad. Separar el rol del borde del rol del comensal para que este no pueda fijar el rol ni la organizacion en el contexto.
