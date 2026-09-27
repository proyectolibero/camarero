---
id: CONTRACT-estados-comanda
type: contract
title: "Estados de la comanda y transiciones permitidas"
status: active
date: 2026-09-27
tags: [comanda, estados, contrato]
related: [D-010]
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
| `aceptada` | `preparando`, `anulada` |
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
4. **El comensal ve el estado en vivo** por Realtime.
5. **El local puede anular desde el KDS.** Es la ultima capa anti-abuso: si la comanda es
   un error, se anula y el comensal recibe aviso.
6. `cerrada` se alcanza tras el cobro registrado en `checkouts`, no antes.
