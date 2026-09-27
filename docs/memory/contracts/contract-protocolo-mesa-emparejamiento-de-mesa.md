---
id: CONTRACT-protocolo-mesa
type: contract
title: "Protocolo de emparejamiento de mesa y anti-abuso"
status: active
date: 2026-09-27
tags: [mesa, protocolo, contrato]
related: [D-008, D-009]
---

## Definicion

El emparejamiento vincula un dispositivo a una sesion de mesa. **Requiere aprobacion humana
de personal del local:** un escaneo de QR no abre nada por si solo. El codigo es imposible de
adivinar, pero la aprobacion humana es la barrera real.

## Flujo

1. El comensal escanea el QR o NFC y abre `app.dominio/t/<codigo>`.
2. El sistema crea una `pairing_request` en estado `pending` y avisa al personal con push y
   sonido: "Mesa 4 pide acceso".
3. Un empleado del local aprueba o rechaza. Rechazo con motivo explica al comensal.
4. Al aprobar, el comensal recibe el alias de la mesa y varios dispositivos pueden unirse a
   la misma sesion.

## Reglas

- **Codigo:** 8 caracteres base32, unico por tabla (unos 40 bits), imposible de adivinar.
- **Expiracion:** la solicitud expira a los **90 s**, con pantalla de reintento clara ("Tu
  mesero no ha respondido").
- **Limite de intentos:** 5 intentos de emparejamiento por dispositivo y hora.
- **Varios dispositivos:** se unen a la misma sesion de mesa.
- **Cierre por inactividad:** la sesion se cierra sola tras 4 h sin actividad, o cuando el
  jefe de sala la cierra.
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
