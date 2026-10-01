---
id: CONTRACT-protocolo-mesa
type: contract
title: Protocolo de emparejamiento de mesa y anti-abuso
status: active
date: 2026-10-01
tags:
  - mesa
  - protocolo
  - contrato
  - emparejamiento
related:
  - D-008
  - D-009
  - ADR-0032
  - LL-024
  - TASK-F1-06
---

## Definicion

El emparejamiento vincula un dispositivo a una sesion de mesa. **Requiere aprobacion humana
de personal del local:** un escaneo de QR no abre nada por si solo. El codigo es imposible de
adivinar, pero la aprobacion humana es la barrera real.

## Flujo

1. El comensal escanea el QR o NFC y abre `app.dominio/t/<codigo>`.
2. El sistema crea una `pairing_request` en estado `pending` y, al PEDIR, fija a la sesion una
   ventana de emparejamiento. Avisa al personal con push y sonido: "Mesa 4 pide acceso".
3. Un empleado aprueba o rechaza. Rechazo con motivo explica al comensal.
4. Al aprobar, el comensal recibe el alias de la mesa y varios dispositivos pueden unirse a
   la misma sesion. La ventana de emparejamiento se limpia y la sesion queda `active`.

## Reglas

- **Codigo:** 8 caracteres base32, unico por tabla (unos 40 bits), imposible de adivinar.
- **Ventana de emparejamiento:** empieza **cuando el comensal pide**, no al escanear, y dura
  **10 minutos** (`camarero_ventana_de_emparejamiento()`). Volver a pedir la **renueva**. Al
  caducar, la solicitud se marca `expired` (la marca el cron del borde, sin que nadie mire) y
  el comensal puede volver a pedir.
- **Vida de la sesion:** la sesion de mesa dura **lo que dura la visita**; se cierra sola tras
  **4 h sin actividad** o cuando el jefe de sala la cierra. Es un plazo DISTINTO de la ventana
  de emparejamiento: la ventana caduca en minutos, la sesion vive horas.
- **Quien decide:** quien puede VER una solicitud pendiente puede DECIDIRLA. El alcance de la
  decision es el mismo que el de la lectura: plataforma, **dueno de la organizacion**
  (`en_mi_org`) y personal del local (`en_mi_local`). El dueno NO es personal del local: su
  alcance es la organizacion (ADR-0032, LL-024).
- **Rastro:** toda decision (aprobacion o rechazo) y todo intento fallido deja fila en
  `audit_log`, ademas de `decided_by` y `decided_at`. Un cero que no se registra no se puede
  reconstruir.
- **Local inactivo:** un local que no este `active` no abre sesiones de mesa.
- **Limite de intentos:** 5 intentos de emparejamiento por dispositivo y hora.
- **Varios dispositivos:** se unen a la misma sesion de mesa.
- **Escalado:** si una solicitud no se atiende en 45 s, se notifica a otro empleado del
  local.

## Seis capas anti-abuso de la comanda

| # | Mecanismo | Que hace |
|---|-----------|----------|
| 1 | Resumen antes de enviar | "3 platos, 12.500 CLP, se enviara a cocina ahora". Sin coste, un toque. |
| 2 | Tope de lineas por envio | Configurable por local (def. 10). Imposible pedir 40 platos de golpe. |
| 3 | Ventana de calma | 25 s desde el ultimo envio a la misma mesa, con cuenta atras. |
| 4 | Anti-doble-tap e idempotencia | Boton deshabilitado mas `idempotency_key` unica; un reintento de red no duplica. |
| 5 | Aviso inequivoco en la carta | "Enviar a cocina es definitivo. Si te equivocaste, pulsa Llamar a mi mesero". |
| 6 | KDS instantaneo con rechazo | La comanda entra como `pending`; cocina o jefe la anula y el comensal recibe aviso. |

**Anti-flood en el KDS:** si una misma mesa genera 3 o mas envios en 2 minutos, el KDS los
colapsa en un bloque con contador ("muchos pedidos seguidos de Mesa 4") en lugar de mostrar
filas separadas.
