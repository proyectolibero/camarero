---
id: D-052
type: decision
title: El reparto por puesto se fija por ruta, y las comandas anteriores conservan cocina
status: accepted
date: 2026-10-01
phase: F1
tags:
  - comanda
  - puestos
  - barra
  - cocina
  - fase-1
related:
  - ADR-0033
  - LL-025
  - TASK-F1-07
  - D-048
---

## Decision

La pantalla de trabajo se elige por RUTA (`/admin/pedidos/<puesto>`, con `cocina`|`barra`|`todo`; sin puesto, cocina) para poder dejarla fijada en la tablet. El destino de una comanda es la copia inmutable de la estacion del plato; un plato sin estacion va al destino generico `cocina`, que exige aprobacion. Nacen aceptados solo `bar` y `bebidas`. El envio deriva una clave de idempotencia por destino (`<clave>.<destino>`). Las comandas anteriores a 0020 conservan el destino `cocina`, que es donde se veian, sin tocar sus estados ni sus importes.

## Justificacion

La ruta es lo mas facil de fijar en un dispositivo que no se va a tocar (marcador del navegador). Dar a las comandas historicas el destino cocina no reescribe su historia y conserva exactamente el comportamiento anterior. El destino generico `cocina` representa con honestidad un plato que nadie clasifico y que necesita que alguien lo acepte.

## Alternativas

1) Seleccionar la pantalla con `?puesto=` en lugar de por ruta: se descarto porque una ruta se fija y se dicta mejor en una tablet que una query. 2) Reinterpretar las comandas historicas por sus lineas (enviar la bebida a barra): se descarto porque reescribiria la historia y una comanda mixta ya cerrada no se puede partir sin mentir; ademas cambiaria de pantalla comandas que el humano ya habia visto en cocina. 3) Marcar automaticos por la estacion exacta (cada una de las cinco): se descarto porque la barra del local es una sola pantalla; se agrupa bar y bebidas. 4) Dejar `orders.prep_station` anulable sin valor: se descarto porque un NULL que se interpreta como cocina es un fallo silencioso esperando a pasar; el DEFAULT explicito lo hace visible.
