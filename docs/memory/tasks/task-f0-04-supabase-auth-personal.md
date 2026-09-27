---
id: TASK-F0-04
type: task
title: "Configurar Supabase con autenticacion de personal y roles"
status: todo
date: 2026-09-27
phase: F0
tags: [fase-0, seguridad, datos]
related: [D-007]
acceptance:
  - "El panel del dueno autentica con Supabase Auth (email y contrasena)"
  - "El PIN de dispositivo es independiente de la sesion del panel"
  - "La clave de servicio solo existe como secreto del proveedor y nunca llega al cliente"
depends_on: [TASK-F0-02]
requires:
  tests: true
  doc: true
tests:
  suite: "pnpm test"
  passed: false
  evidence: null
doc: null
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
