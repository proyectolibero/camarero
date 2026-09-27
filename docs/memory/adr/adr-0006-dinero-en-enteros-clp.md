---
id: ADR-0006
type: adr
title: "Dinero en enteros de pesos chilenos"
status: accepted
date: 2026-09-27
tags: [dinero, dominio, correccion]
related: []
---

## Contexto

El reparto de una cuenta es el nucleo de negocio. Un error de redondeo no es un bug
cosmetico: es una pelea con un cliente real en la barra de un local. La coma flotante de
JavaScript no representa de forma exacta valores decimales, y cualquier calculo basado en
`float` arrastra diferencias que aparecen justo cuando se divide la cuenta.

## Decision

Todos los importes son **enteros de pesos chilenos (CLP)**.

- Nunca coma flotante y nunca `.toFixed()` para calcular.
- Una **unica** funcion de calculo de totales en `packages/domain`.
- El reparto de cuenta tiene **100 % de cobertura obligatoria**, con los casos borde
  documentados en `CONTRACT-dinero`.

## Alternativas consideradas

- **Numeros en coma flotante:** descartados por errores de redondeo acumulativos.
- **Biblioteca de decimales (tipo decimal.js):** descartada porque el CLP no tiene
  subunidad y una dependencia extra no aporta nada frente al entero.
- **Enteros de centavos:** descartados porque el peso chileno no usa centavos; anadir una
  unidad fraccionaria ficticia solo complica las cuentas.
- **Guardar el importe como texto y operar con el:** descartado por lento y propenso a
  errores de parseo.

## Consecuencias

- La formula de calculo es unica y se puede probar exhaustivamente.
- Los casos borde (division con resto, descuento que no da entero, propina sobre el total
  ya descontado, division entre uno) son obligatorios en la bateria de tests.
- Cualquier dato de dinero que venga del exterior se convierte a entero en el borde y se
  valida antes de usarlo.
