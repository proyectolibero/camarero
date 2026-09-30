---
id: TASK-F0-04
type: task
title: Configurar Supabase con autenticacion de personal y roles
status: done
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
doc: contracts/contract-borde-contract-borde-el-borde-de-cloudflare-pages-workers-y-r2.md
requires:
  tests: true
  doc: true
tests:
  suite: pnpm test
  passed: true
  evidence: "2026-09-30 · pnpm test · workers/api 49 pasan, packages/db 49 pasan, tools/mcp-memory 95 pasan, 0 fallan. En vivo: el dueno entro en /admin con un pasaporte REAL emitido por Supabase Auth (no fabricado en pruebas) y vio su ficha; con credenciales que no valen, la respuesta es identica byte a byte a la de un correo inexistente. La verificacion de la firma se hace contra el JWKS publico del proveedor (ADR-0021), sin que el borde guarde secreto alguno para verificar. La clave de servicio no se usa en ningun sitio: sus privilegios sobre public estan revocados y nunca ha estado en el cliente ni en el borde."
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

- **2026-09-30** — Cerrada tras la prueba de punta a punta con un pasaporte real. Estado honesto de cada criterio: (1) el panel del dueno autentica con correo y contrasena — CUMPLIDO y verificado en vivo; (2) el PIN de dispositivo es independiente de la sesion del panel — el MECANISMO esta construido y probado (workers/api/src/auth/pin.ts con 5 pruebas, camarero_device_token() y su politica en la migracion 0015), pero la ENTRADA por PIN pertenece a la superficie /staff y se traslada a TASK-F1-03; no se cierra esta tarea fingiendo que existe un flujo que no existe; (3) la clave de servicio solo existe como secreto del proveedor y nunca llega al cliente — CUMPLIDO, y mejor de lo pedido: no se usa clave de servicio en ningun sitio. Trozo 1 (ADR-0019, migracion 0015) y trozo 2 (la verificacion del pasaporte, que termino siendo por JWKS asimetrico, ADR-0021) mas el trozo 3 (el proyecto real: usuario de panel, secretos y el acceso verificado).
