---
id: TASK-F1-01
type: task
title: "Emparejamiento de mesa con aprobacion humana"
status: todo
date: 2026-09-27
phase: F1
tags: [fase-1, mesa, protocolo]
related: [D-008, ADR-0031, ADR-0032, CONTRACT-protocolo-mesa, TASK-F1-06, TASK-F1-10]
acceptance:
  - "Un escaneo de QR no abre la mesa: requiere aprobacion de un empleado del local"
  - "El codigo es de 8 caracteres base32 y la solicitud expira a los 10 minutos (ADR-0032)"
  - "Varios dispositivos se unen a la misma sesion; el limite de intentos por dispositivo queda para F2 (ADR-0031)"
  - "La sesion se cierra sola tras 4 horas de inactividad o cuando el jefe de sala la cierra (TASK-F1-10)"
depends_on: [TASK-F0-03, TASK-F0-04]
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
- [ ] El codigo es de 8 caracteres base32 y la solicitud expira a los 10 minutos (ADR-0032)
- [ ] Varios dispositivos se unen a la misma sesion; el limite de intentos por dispositivo queda para F2 (ADR-0031)
- [ ] La sesion se cierra sola tras 4 horas de inactividad o cuando el jefe de sala la cierra (TASK-F1-10)

## Que cambio y que queda (revision 2026-10-01)

Este documento decia «la solicitud expira a los 90 segundos» y «el limite de intentos es de
5 por hora». Las dos cosas quedaron superadas por decisiones posteriores:

- **Ventana de emparejamiento: 90 s -> 10 minutos.** ADR-0032 y la migracion `0019` fijan
  diez minutos desde que el comensal PIDE (no desde que escanea), y volver a pedir la renueva.
  El plazo de 90 s era imposible de cumplir en un local real.
- **Limite de intentos: fuera de F1.** ADR-0031 deja el token de dispositivo y el limite de
  intentos por dispositivo para F2: la tabla de contadores no la puede usar el rol de la
  aplicacion en esta fase. Pedir emparejarse funciona; lo que falta es el freno por device.

**Ya hecho:** la ventana de 10 minutos, la decision con rastro (ADR-0032), la aprobacion como
barrera de base y el cierre de la sesion (TASK-F1-10). **Queda:** el limite de intentos por
dispositivo (F2, ADR-0031) y el token de dispositivo.
