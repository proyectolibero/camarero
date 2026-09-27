---
id: CONTRACT-dinero
type: contract
title: "Reglas de dinero y calculo de totales"
status: active
date: 2026-09-27
tags: [dinero, dominio, contrato]
related: [ADR-0006]
---

## Definiciones

- **bruto** — Suma de `unit_price_clp × qty` mas los `price_delta_clp` de los
  modificadores, en enteros.
- **descuento** — Reduccion aplicada por una promocion, redondeada a entero por piso y
  limitada por `max_discount_clp` o por el subtotal.
- **subtotal** — `bruto − descuento`.
- **propina** — `piso(subtotal × tip_percent / 100)`.
- **total** — `subtotal + propina`.

## Formula unica

```
bruto     = suma( unit_price_clp * qty + suma(price_delta_clp) )
descuento = aplicar_promocion(bruto, promocion)
subtotal  = bruto - descuento
propina   = piso( subtotal * tip_percent / 100 )
total     = subtotal + propina
```

Es la unica funcion de calculo de totales, en `packages/domain`, sin I/O.

## Invariantes

1. Todos los importes son enteros de CLP. Nunca coma flotante, nunca `.toFixed()` para
   calcular.
2. La propina se calcula **sobre el subtotal ya descontado**, nunca sobre el bruto.
3. El descuento nunca deja el subtotal por debajo de cero.
4. El reparto equitativo reparte el resto de 1 peso entre los primeros `total % n`, en
   orden estable. La suma de las partes es exactamente el total.
5. El precio nunca viene del cliente: se calcula desde `menu_items`.

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
- Descuento mayor que el bruto: limitado a `max_discount_clp` o al subtotal.
- Linea a medio asignar a 2 personas con total impar.
- Cuenta con un solo comensal: no dividir por cero.
- Propina sobre el total ya descontado, no sobre el bruto.

## Propina sugerida

Selector 0 / 5 / 10 / 15 / 20 %, con valor por defecto configurable por local. Se registra
como "propina sugerida a incluir en la cuenta" y se entrega al jefe de sala para que la
aplique en el TPV. El 100 % es del local; el sistema no reparte propina por empleado.
