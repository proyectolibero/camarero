---
id: D-019
type: decision
title: "Coexisten el pedido desde mesa y la toma de comanda del camarero"
status: accepted
date: 2026-09-27
tags: [producto]
related: []
---

## Decision

Coexisten dos modos de origen de una comanda: el pedido del comensal desde su mesa
(`source = table`) y la toma de comanda desde el móvil del camarero (`source = staff`). Ambos
comparten el mismo modelo de datos.

## Justificacion

No todos los locales ni todas las mesas usan el mismo flujo, y el camarero sigue siendo
necesario para atender mesas sin QR o pedidos verbales. Mantener ambos sistemas da
flexibilidad sin duplicar el modelo.

## Alternativas

- **Solo pedido desde mesa:** descartado porque excluye a locales y mesas sin QR.
- **Solo toma de comanda por el camarero:** descartado porque renuncia a la propuesta de
  valor del producto.
- **Modelo de datos separado por origen:** descartado por duplicación y mantenimiento.
