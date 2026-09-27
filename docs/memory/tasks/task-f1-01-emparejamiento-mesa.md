---
id: TASK-F1-01
type: task
title: "Emparejamiento de mesa con aprobacion humana"
status: todo
date: 2026-09-27
phase: F1
tags: [fase-1, mesa, protocolo]
related: [D-008]
acceptance:
  - "Un escaneo de QR no abre la mesa: requiere aprobacion de un empleado del local"
  - "El codigo es de 8 caracteres base32 y la solicitud expira a los 90 segundos"
  - "Varios dispositivos se unen a la misma sesion y el limite de intentos es de 5 por hora"
  - "La sesion se cierra sola tras 4 horas de inactividad o cuando el jefe de sala la cierra"
depends_on: [TASK-F0-03, TASK-F0-04]
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

Implementar el flujo de la seccion 5.1 de PLAN.md: el comensal escanea el QR o NFC, el
sistema crea una `pairing_request` en estado `pending` y avisa al personal, que aprueba o
rechaza. Al aprobar, varios dispositivos entran en la misma sesion de mesa. Todo el flujo va
con tests al 100 %, porque es la puerta de entrada al producto y la barrera anti-abuso
principal.

## Aceptacion

- [ ] Un escaneo de QR no abre la mesa: requiere aprobacion de un empleado del local
- [ ] El codigo es de 8 caracteres base32 y la solicitud expira a los 90 segundos
- [ ] Varios dispositivos se unen a la misma sesion y el limite de intentos es de 5 por hora
- [ ] La sesion se cierra sola tras 4 horas de inactividad o cuando el jefe de sala la cierra
