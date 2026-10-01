---
id: CONTRACT-estados-comanda
type: contract
title: Estados de la comanda y transiciones permitidas
status: active
date: 2026-10-01
tags:
  - comanda
  - estados
  - contrato
  - servicio
related:
  - D-010
  - D-055
---

## Definicion

La comanda avanza por seis estados mas el estado terminal `anulada`. El cambio de estado se
registra siempre en `audit_log` y el comensal lo ve en vivo.

## Estados

`pendiente`, `aceptada`, `preparando`, `lista`, `servida`, `cerrada` y `anulada`.

## Transiciones permitidas

| De | A |
|----|---|
| `pendiente` | `aceptada`, `anulada` |
| `aceptada` | `preparando`, `servida`, `anulada` |
| `preparando` | `lista`, `anulada` |
| `lista` | `servida`, `anulada` |
| `servida` | `cerrada`, `anulada` |
| `cerrada` | terminal |
| `anulada` | terminal |

La matriz vive en `packages/domain/order-state.ts` y tiene **100 % de cobertura de tests**.

## Reglas

1. **No se retrocede.** Un estado solo avanza hacia adelante o pasa a `anulada`.
2. **Todo cambio va a auditoria.** Accion, actor, entidad y estado anterior y posterior
   quedan en `audit_log`, que es inmutable.
3. **La comanda entra como `pendiente`, no como `aceptada`.** La cocina o el jefe de sala
   la acepta; ese es el estado real.
4. **`aceptada -> servida` es una transicion legitima** (D-055) para los puestos que no
   preparan nada: una bebida que solo hay que entregar se sirve en **un solo toque** desde
   `aceptada`, sin pasar por `preparando` ni por `lista`. El atajo vive en la matriz del
   dominio, no escondido en un boton, de modo que la pantalla, el modelo y la base dicen lo
   mismo. El avance natural de una comanda aceptada sigue siendo `preparando`.
5. **El comensal ve el estado en vivo mientras hay algo en marcha** (una comanda sin
   servir): su pantalla se refresca sola con un `meta refresh`, sin JavaScript, y deja de
   refrescarse cuando ya no hay nada que contar. La base permite al comensal tocar su
   actividad, no su estado.
6. **El local puede anular desde el KDS.** Es la ultima capa anti-abuso: si la comanda es
   un error, se anula y el comensal recibe aviso.
7. `cerrada` se alcanza tras el cobro registrado en `checkouts`, no antes.
