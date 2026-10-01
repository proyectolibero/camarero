---
id: CONTRACT-protocolo-mesa
type: contract
title: CONTRACT-protocolo-mesa — Emparejamiento de mesa y anti-abuso, con el estado REAL de cada proteccion
status: active
date: 2026-10-01
tags:
  - mesa
  - protocolo
  - contrato
  - emparejamiento
  - anti-abuso
related:
  - D-008
  - D-009
  - ADR-0031
  - ADR-0032
  - LL-022
  - LL-024
  - TASK-F1-06
  - TASK-F1-10
---

## Definición

El emparejamiento vincula un dispositivo a una sesión de mesa. **Requiere aprobación humana de personal del local:** un escaneo de QR no abre nada por sí solo. El código es imposible de adivinar, pero la aprobación humana es la barrera real.

## Aviso sobre este documento

Este contrato se escribió **por delante de la implementación**, y eso le costó caro al proyecto: durante semanas afirmó protecciones que **nadie había construido**, y una auditoría independiente tuvo que señalarlo (`LL-022`). Por eso ahora **cada apartado dice si está construido y probado o si sigue siendo un plan.** Lo que no lleva marca, no existe.

## Flujo

1. El comensal escanea el QR y abre `/t/<código>`. **✅ Construido.**
2. El sistema crea la solicitud, fija la ventana **al pedir** y el comensal ve que espera. **✅ Construido.** Avisar al personal con push y sonido: **⬜ Planificado (F2).**
3. Un empleado aprueba o rechaza desde el panel, desde la sala o desde una pantalla de puesto. Rechazar admite motivo. **✅ Construido y probado.**
4. Al aprobar, la sesión queda `active` y el comensal puede pedir. Varios dispositivos en la misma sesión: **⬜ Planificado (el identificador de sesión es hoy un token al portador).** Ver `OQ` del token de dispositivo.

## Reglas

| Regla | Estado |
|-------|--------|
| **Código:** 8 caracteres base32, único por mesa, imposible de adivinar | ✅ Construido |
| **Ventana de emparejamiento:** empieza **al pedir**, dura **10 minutos** y volver a pedir la renueva (`camarero_ventana_de_emparejamiento()`) | ✅ Construido y probado |
| **Caducada:** la solicitud se marca `expired` por el cron del borde, sin que nadie mire | ✅ Construido |
| **Vida de la sesión:** dura la visita; se cierra sola tras **4 h sin actividad** o cuando el local la cierra a mano | ✅ Construido (`TASK-F1-10`). Es un plazo **distinto** de la ventana: la ventana caduca en minutos, la sesión vive horas |
| **Quién decide:** quien puede **ver** una solicitud pendiente puede **decidirla**. Mismo alcance en lectura y en decisión: plataforma, **dueño de la organización** (`en_mi_org`) y personal del local (`en_mi_local`). El dueño **no** es personal del local: su alcance es la organización (`ADR-0032`, `LL-024`) | ✅ Construido y probado |
| **Rastro:** toda decisión y todo intento fallido deja fila en `audit_log`, más `decided_by` y `decided_at` | ✅ Construido |
| **Local inactivo:** un local que no esté `active` no abre sesiones de mesa | ✅ Construido y probado |
| **Límite de intentos:** 5 por dispositivo y hora | ⬜ **Planificado (F2).** No existe, y depende del token de dispositivo, que tampoco existe |
| **Escalado:** si una solicitud no se atiende en 45 s, avisar a otro empleado | ⬜ Planificado (F2) |

## Las seis capas anti-abuso de la comanda

| # | Mecanismo | Estado |
|---|-----------|--------|
| 1 | **Resumen antes de enviar** («3 platos, $12.500, se enviará ahora») | ✅ Construido (la cesta) |
| 2 | **Tope de líneas por envío**, configurable por local (def. 10) | ⚠️ **Parcial:** hay un tope, pero está **fijo en el código** y no es configurable por local |
| 3 | **Ventana de calma** de 25 s con cuenta atrás | ⬜ **Planificado (F2)** |
| 4 | **Anti-doble-toque e idempotencia** | ✅ Construido y probado (`orders.idempotency_key`) |
| 5 | **Aviso inequívoco en la carta** («enviar es definitivo…») | ✅ Construido (en la cesta, antes de enviar) |
| 6 | **La cocina puede anular**, y el comensal lo ve | ✅ Construido y probado |

**Anti-flood en el KDS** (colapsar 3+ envíos de la misma mesa en 2 minutos): ⬜ **Planificado (F2).**

## Lo que este contrato NO promete

Hoy un comensal con el identificador de sesión **puede** hacer todo lo que hace el comensal de esa mesa, y el identificador no está atado a un dispositivo. **No hay límite de intentos ni de envíos.** Es el hueco consciente más grande del protocolo, está declarado en `ADR-0031` y se cierra en F2 junto con el token de dispositivo.

Lo que **sí** protege hoy: la aprobación humana (que es barrera de base, no de pantalla), la barrera de sesión aprobada para pedir, la idempotencia, el cierre por inactividad, y que el local pueda anular desde su pantalla.
