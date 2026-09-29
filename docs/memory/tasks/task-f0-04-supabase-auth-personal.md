---
id: TASK-F0-04
type: task
title: Configurar Supabase con autenticacion de personal y roles
status: doing
date: 2026-09-27
phase: F0
tags:
  - fase-0
  - seguridad
  - datos
related:
  - D-007
acceptance:
  - El panel del dueno autentica con Supabase Auth (email y contrasena)
  - El PIN de dispositivo es independiente de la sesion del panel
  - La clave de servicio solo existe como secreto del proveedor y nunca llega al cliente
depends_on:
  - TASK-F0-02
doc: null
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Configurar la autenticacion del personal con Supabase Auth y la matriz de roles
(`platform_admin`, `org_owner`, `location_manager`, `server`, `kitchen`, `no_pin`). La sesion
del panel y el PIN de dispositivo son mecanismos separados. La clave de servicio vive
unicamente como secreto en Workers y jamas se expone al cliente.

## Aceptacion

- [ ] El panel del dueno autentica con Supabase Auth (email y contrasena)
- [ ] El PIN de dispositivo es independiente de la sesion del panel
- [ ] La clave de servicio solo existe como secreto del proveedor y nunca llega al cliente

## Notas

- **2026-09-29** — EN CURSO. Hecho y verificado (trozo 1, el puente de identidad): migracion 0015_auth_y_contexto.sql con staff.auth_user_id (unico parcial), camarero_auth_uid() (reclamacion sub del token) y camarero_device_token() (token opaco del dispositivo), mas dos politicas minimas de solo lectura (staff_select_auth y staff_devices_select_por_token). Diseno en ADR-0019. Verificado: 49 tests de base de datos en verde (7 nuevos en auth.test.ts), sin regresion en rls.test.ts (24), invariante de ciclos en [] y 0 funciones definer sin endurecer, typecheck 0, biome 0. Sin llave maestra: no se usa ningun rol con BYPASSRLS. FALTA trozo 2 (el borde: verificar el token de Supabase y el PIN con Web Crypto, con tests sobre jwt generados en local) y trozo 3 (el proyecto real de Supabase: usuario de panel, secretos, y la clave de servicio solo como secreto del proveedor). El trozo 2 no necesita cuenta de Supabase; el 3 si.
