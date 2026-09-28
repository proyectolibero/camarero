---
id: CONTRACT-dinero
type: contract
title: CONTRACT-dinero — Reglas de dinero y calculo de totales
status: active
date: 2026-09-28
tags:
  - dinero
  - dominio
  - contrato
related:
  - ADR-0006
  - D-039
---

## Definiciones

Las definiciones son **unicas**. Fijadas en `D-039`; cualquier documento que diga otra
cosa sobre estas palabras esta equivocado y se reemplaza.

- **subtotal** — Suma de `unit_price_clp × qty` mas los `price_delta_clp` de los
  modificadores, en enteros. **Sin descontar.**
- **descuento** — Reduccion aplicada por una promocion, redondeada a entero por piso y
  limitada por `max_discount_clp` o por el subtotal.
- **importe a pagar** — `subtotal − descuento`. Es lo que paga el cliente antes de propina.
- **propina** — `piso(importe a pagar × tip_percent / 100)`. **Se calcula sobre el importe
  ya descontado**, nunca sobre el subtotal.
- **total** — `importe a pagar + propina`.

Ojo con la palabra: **`subtotal` NO lleva el descuento restado**. El descuento va en su
propia columna (`discount_clp`). Quien lea la cuenta ve el subtotal, luego el descuento,
y luego lo que paga.

## Formula unica

```
subtotal  = suma( unit_price_clp * qty + suma(price_delta_clp) )
descuento = aplicar_promocion(subtotal, promocion)
a_pagar   = subtotal - descuento
propina   = piso( a_pagar * tip_percent / 100 )
total     = a_pagar + propina
```

Es la unica funcion de calculo de totales, en `packages/domain`, sin I/O.

## Invariantes

1. Todos los importes son enteros de CLP. Nunca coma flotante, nunca `.toFixed()` para
   calcular.
2. La propina se calcula **sobre el importe ya descontado**, nunca sobre el subtotal.
3. El descuento nunca deja el importe por debajo de cero.
4. El reparto equitativo reparte el resto de 1 peso entre los primeros `total % n`, en
   orden estable. La suma de las partes es exactamente el total.
5. El precio nunca viene del cliente: se calcula desde `menu_items`.

## El descuento en la comanda

El descuento **no lo envia quien pide**. La carta del cliente puede traer un precio ya
rebajado (oferta visible: el cliente ve el precio bueno y pide), y ademas puede existir un
descuento que se aplica **al cobrar la cuenta**, con su motivo escrito en la cuenta. En
ningun caso el importe del descuento procede del dispositivo del comensal.

## Modos de reparto

| Modo | Algoritmo |
|------|-----------|
| `by_item` | Cada comensal marca lineas; una linea puede dividirse entre N (con pesos o a medias). |
| `equal` | `total / n` con reparto exacto del resto, en orden estable. |
| `half` | Reparto en 2, con resto explicito a una parte cuando el total es impar. |
| `manual` | El jefe de sala fija montos; validados contra el total, sin exceder ni quedar corto. |

## Casos borde obligatorios

- Total 12.500 dividido entre 3 → 4.166 / 4.167 / 4.167, suma exacta 12.500.
- Modificadores con delta: 8.900 + "extra queso" 900 = 9.800.
- Descuento porcentual que no da entero: 10 % de 9.990 = 999; 10 % de 9.995 = 999,5 →
  piso 999.
- Descuento mayor que el subtotal: limitado a `max_discount_clp` o al subtotal.
- Linea a medio asignar a 2 personas con total impar.
- Cuenta con un solo comensal: no dividir por cero.
- Propina sobre el importe ya descontado, no sobre el subtotal.

## Propina sugerida

Selector 0 / 5 / 10 / 15 / 20 %, con valor por defecto configurable por local. Se registra
como "propina sugerida a incluir en la cuenta" y se entrega al jefe de sala para que la
aplique en el TPV. El 100 % es del local; el sistema no reparte propina por empleado.
