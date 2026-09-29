---
id: RISK-020
type: risk
title: El rol del borde pierde su contrasena al restaurar o despausar el proyecto de Supabase
status: open
date: 2026-09-29
tags:
  - supabase
  - operacion
  - rls
  - seguridad
  - fase-0
related: []
impact: alto
likelihood: media
---

## Riesgo

Al investigar los roles de un Postgres gestionado aparecieron tres hechos que hay que tener presentes y que no eran obvios. (1) En Supabase, el rol postgres tiene BYPASSRLS (no es superusuario, pero si bypass), asi que ignora las 96 politicas; lo mismo service_role y supabase_admin. El aislamiento depende de que el borde conecte SIEMPRE con camarero_app (nosuperuser, nobypassrls) y nunca con postgres. (2) Supabase concede permisos por defecto en el esquema public a anon, authenticated y service_role; como service_role tiene BYPASSRLS, si conserva acceso a nuestras tablas y su clave se filtra, el aislamiento desaparece. Por eso el modo gestionado revoca esos permisos al aprovisionar. (3) Las contrasenas de roles personalizados NO se guardan en las copias de seguridad: tras un restore, o tras despausar un proyecto del plan gratuito por inactividad, la contrasena de camarero_app queda vacia y la conexion del borde falla con error de autenticacion hasta volver a fijarla. Es la interaccion entre RISK-001 (el plan gratuito se pausa) y nuestra dependencia de un rol propio.

## Evaluacion

- Probabilidad: media
- Impacto: alto

## Mitigacion

Dejar en el manual de operacion (CONTRACT-borde) el paso de recuperacion: tras un restore o un despause, ejecutar como administrador ALTER ROLE camarero_app WITH PASSWORD ... antes de dar por bueno el servicio. El keep-alive programado que se anada para RISK-001 reduce la frecuencia de despauses, no la elimina. Ademas, el borde debe tratar el fallo de autenticacion de base de datos como incidencia visible, no como error generico, para que se detecte en cuanto ocurra.
