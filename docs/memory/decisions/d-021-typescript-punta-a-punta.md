---
id: D-021
type: decision
title: "TypeScript de punta a punta"
status: accepted
date: 2026-09-27
tags: [tecnico, infraestructura]
related: []
---

## Decision

Todo el stack se escribe en TypeScript de punta a punta, en ESM y con `strict`, desde la
PWA hasta los Workers y la lógica de dominio.

## Justificacion

Un solo lenguaje reduce el coste cognitivo y de mantenimiento para un único mantenedor, y
comparte tipos entre cliente, API y dominio. Encaja con el runtime Node moderno con type
stripping.

## Alternativas

- **JavaScript sin tipos:** descartado por errores evitables y peor mantenibilidad.
- **Stack mixto (otro lenguaje en el backend):** descartado por duplicar lenguajes y
  modelos.
- **Framework con DSL propietario:** descartado por dependencia y por menor portabilidad.
