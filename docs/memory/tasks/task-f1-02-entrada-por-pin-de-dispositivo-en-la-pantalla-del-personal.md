---
id: TASK-F1-02
type: task
title: Entrada por PIN de dispositivo en la pantalla del personal
status: todo
date: 2026-09-30
phase: F1
tags:
  - personal
  - autenticacion
  - pin
  - fase-1
  - arrastrada-de-f0
related:
  - ADR-0015
  - ADR-0019
  - TASK-F0-04
  - CONTRACT-pantallas
acceptance:
  - El dispositivo del local se empareja una sola vez y queda vinculado a ese local; a partir de ahi cada persona entra con su PIN
  - "El PIN no reutiliza la sesion del panel: son dos mecanismos separados, cada uno con su prueba"
  - Un PIN incorrecto no distingue entre uno que no existe y uno que no corresponde a ese local
  - Se limita el numero de intentos por dispositivo, o se delega de forma explicita y se documenta por que
  - El PIN nunca se guarda en claro ni aparece en ningun registro
  - "Pruebas: caso feliz, PIN incorrecto, dispositivo sin emparejar, y que un PIN valido de un local no sirve en otro"
depends_on: []
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

La entrada de la superficie /staff por PIN de dispositivo. El MECANISMO ya existe y esta probado (workers/api/src/auth/pin.ts con hash PBKDF2 y comparacion en tiempo constante, staff.pin_hash, camarero_device_token() y la politica staff_devices_select_por_token de la migracion 0015), pero NO existe el flujo. Se separo de TASK-F0-04 para no cerrar aquella fingiendo que existia algo que no. Es la entrada de la tablet del local (ADR-0015): el aparato se empareja una vez y se queda como el local; cada garzon se identifica con su PIN, sin compartir la sesion del panel.

## Aceptacion

- [ ] El dispositivo del local se empareja una sola vez y queda vinculado a ese local; a partir de ahi cada persona entra con su PIN
- [ ] El PIN no reutiliza la sesion del panel: son dos mecanismos separados, cada uno con su prueba
- [ ] Un PIN incorrecto no distingue entre uno que no existe y uno que no corresponde a ese local
- [ ] Se limita el numero de intentos por dispositivo, o se delega de forma explicita y se documenta por que
- [ ] El PIN nunca se guarda en claro ni aparece en ningun registro
- [ ] Pruebas: caso feliz, PIN incorrecto, dispositivo sin emparejar, y que un PIN valido de un local no sirve en otro
