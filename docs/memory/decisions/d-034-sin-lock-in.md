---
id: D-034
type: decision
title: "AGPL y sin lock-in: exportacion abierta de datos"
status: accepted
date: 2026-09-27
tags: [negocio, tecnico]
related: []
---

## Decision

La licencia AGPL se combina con ausencia de lock-in: el cliente puede exportar sus datos
(menú, mesas, pedidos y métricas) en CSV o JSON y seguir usando el software por su cuenta.

## Justificacion

Es el arma anti-captura que impide que un local quede atrapado y que alguien pueda
chantajear al proyecto. Si el cliente se va, se lleva sus datos.

## Alternativas

- **Formato propietario sin exportación:** descartado porque contradice la promesa ética.
- **Exportación de pago o limitada:** descartada por la misma razón.
- **SaaS cerrado sin autohospedaje:** descartado por contradecir la licencia AGPL.
