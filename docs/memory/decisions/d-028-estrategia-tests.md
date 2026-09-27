---
id: D-028
type: decision
title: "Estrategia de tests: 70 % en negocio y 100 % en reparto de cuenta"
status: accepted
date: 2026-09-27
tags: [calidad, tecnico]
related: []
---

## Decision

La estrategia de tests exige 70 % de cobertura en lógica de negocio y 100 % en el reparto de
cuenta. El dominio puro se cubre al 100 %, la API al 80 %, los componentes al 70 % y hay
cinco flujos E2E obligatorios antes de cualquier piloto.

## Justificacion

Un error de redondeo en el reparto de la cuenta es una pelea con un cliente real, por lo
que esa parte no admite cobertura parcial. La suite debe correr en menos de 60 segundos
porque una suite lenta no se ejecuta.

## Alternativas

- **Sin cobertura mínima obligatoria:** descartado porque deja sin red de seguridad la
  lógica crítica.
- **100 % en todo el código:** descartado por coste desproporcionado respecto al riesgo.
- **Cobertura solo en la UI:** descartada porque no protege la lógica de negocio.
