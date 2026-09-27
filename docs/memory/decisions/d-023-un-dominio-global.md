---
id: D-023
type: decision
title: "Un solo dominio global"
status: accepted
date: 2026-09-27
tags: [infraestructura, producto]
related: []
---

## Decision

Se usa un único dominio global. La mesa se abre en `app.dominio/t/<codigo>`, la PWA del
empleado en `/staff` y el panel del dueño en `/admin`.

## Justificacion

Un solo dominio simplifica el certificado, la seguridad, el despliegue y la comunicación al
local. El QR y el NFC apuntan a la misma URL canónica.

## Alternativas

- **Un subdominio por local:** descartado por coste de certificados, configuración y
  mantenimiento.
- **Dominio propio por local:** descartado por complejidad y por depender del DNS del
  cliente.
- **Varios dominios por rol:** descartados por fragmentar la seguridad y la sesión.
