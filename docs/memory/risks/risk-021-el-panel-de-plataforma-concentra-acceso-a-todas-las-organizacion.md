---
id: RISK-021
type: risk
title: "El panel de plataforma concentra acceso a todas las organizaciones: es un objetivo unico y de altisimo valor"
status: open
date: 2026-09-30
tags:
  - plataforma
  - permisos
  - seguridad
  - multi-tenant
related: []
impact: alto
likelihood: media
---

## Riesgo

Pedir "un backend con control total" concentra en una sola superficie el acceso a todas las organizaciones, sus cartas, comandas y facturacion. Si esa cuenta se compromete, se compromete todo el producto, y ademas un error de diseño se convierte en fuga entre clientes. Mitigacion: el rol platform_admin no debe leer datos de negocio por defecto (solo metadatos de organizacion y locales); ver como un cliente debe ser una accion explicita, temporal, con motivo y registrada en audit_log; y la cerradura debe vivir en la base (politica RLS), no en la pantalla. Nota: audit_log ya es inmutable en el esquema.

## Evaluacion

- Probabilidad: media
- Impacto: alto

## Mitigacion

El rol de plataforma no lee datos de negocio por defecto: solo metadatos de organizaciones y locales. Ver los datos de un cliente es una accion explicita, temporal, con motivo escrito y registrada en audit_log (que ya es inmutable). La restriccion se aplica en la politica RLS, no en la pantalla, y se prueba con datos reales como el resto.
