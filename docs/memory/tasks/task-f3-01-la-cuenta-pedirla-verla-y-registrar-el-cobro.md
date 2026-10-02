---
id: TASK-F3-01
type: task
title: "La cuenta: pedirla, verla y registrar el cobro"
status: review
date: 2026-10-02
phase: F3
tags:
  - cuenta
  - cobro
  - dinero
  - piloto
  - fase-3
related:
  - ADR-0016
  - CONTRACT-dinero
  - CONTRACT-estados-comanda
  - D-039
  - D-055
  - TASK-F1-12
acceptance:
  - El comensal puede PEDIR LA CUENTA desde su telefono, y ve que la ha pedido
  - El local ve las cuentas pedidas en su pantalla, con la mesa y lo que ha consumido
  - "Un empleado REGISTRA EL COBRO: importe, propina y forma de pago (sin tocar nunca datos de tarjeta)"
  - Al registrar el cobro, la mesa se cierra y el comensal lo ve
  - "El importe que se cobra sale de la base, nunca del cliente: se demuestra manipulando la peticion"
  - La propina se calcula sobre el total ya descontado (CONTRACT-dinero, D-039) y con la funcion unica de totales
  - Se ve claro quien cobro y cuando, y queda rastro en la auditoria
  - Un comensal no puede registrar un cobro, ni ver la cuenta de otra mesa (se demuestra)
  - El comensal que pide la cuenta no puede seguir pidiendo platos
  - "Pruebas: pedir la cuenta, verla el local, registrar el cobro, la mesa se cierra, el importe no viene del cliente, el aislamiento, y pedir tras la cuenta"
  - "En vivo: el dueno pide la cuenta desde el telefono y la cobra desde el panel"
depends_on:
  - TASK-F1-12
doc: contracts/contract-dinero-reglas-de-dinero.md
tests:
  suite: pnpm test
  passed: true
  evidence: 2026-10-01 · pnpm test · domain 29, api 358, db 142, mcp 95 = 624 pasan, 0 fallan; pnpm typecheck y pnpm biome ci . en verde
---

## Descripcion

Tramo 1 del camino al piloto (D-057): poner en funcionamiento LA CUENTA, que es lo unico que le falta al flujo entero. Hoy el comensal puede pedir pero no puede pedir la cuenta, y el local no puede registrar el cobro. Incluye lo minimo honesto: el comensal pide la cuenta y ve que la ha pedido; el local la ve con la mesa y su consumo; un empleado registra el cobro (importe, propina y forma de pago, SIN tocar datos de tarjeta jamas: checkouts no guarda ni numero ni autorizacion, y eso es un contrato de producto); al cobrar, la mesa se cierra. NO incluye los cuatro modos de reparto de la cuenta (llegan despues) ni el pago desde la app: el dinero no pasa por aqui y no pasara. Las cuentas y las propinas tienen que usar la funcion unica de totales del dominio.

## Aceptacion

- [ ] El comensal puede PEDIR LA CUENTA desde su telefono, y ve que la ha pedido
- [ ] El local ve las cuentas pedidas en su pantalla, con la mesa y lo que ha consumido
- [ ] Un empleado REGISTRA EL COBRO: importe, propina y forma de pago (sin tocar nunca datos de tarjeta)
- [ ] Al registrar el cobro, la mesa se cierra y el comensal lo ve
- [ ] El importe que se cobra sale de la base, nunca del cliente: se demuestra manipulando la peticion
- [ ] La propina se calcula sobre el total ya descontado (CONTRACT-dinero, D-039) y con la funcion unica de totales
- [ ] Se ve claro quien cobro y cuando, y queda rastro en la auditoria
- [ ] Un comensal no puede registrar un cobro, ni ver la cuenta de otra mesa (se demuestra)
- [ ] El comensal que pide la cuenta no puede seguir pidiendo platos
- [ ] Pruebas: pedir la cuenta, verla el local, registrar el cobro, la mesa se cierra, el importe no viene del cliente, el aislamiento, y pedir tras la cuenta
- [ ] En vivo: el dueno pide la cuenta desde el telefono y la cobra desde el panel

## Notas

- **2026-10-02** — Construida y verificada; NO cerrada: falta la prueba con el dedo del humano en vivo. Incluye migracion 0023 (split_mode 'none' y barrera de base), funcion unica calcularCuenta en packages/domain, rutas del comensal y del panel, y la previsualizacion mirada (LL-020).
