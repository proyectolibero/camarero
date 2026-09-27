---
id: D-007
type: decision
title: "El comensal es anonimo con alias de mesa"
status: accepted
date: 2026-09-27
tags: [producto, privacidad]
related: []
---

## Decision

El comensal permanece anónimo: se identifica con un alias de mesa y un token de sesión
opaco, sin nombre, correo ni teléfono. El sistema no guarda su identidad.

## Justificacion

Minimiza los datos personales tratados y reduce el riesgo bajo la Ley 21.719 de protección
de datos personales de Chile. Es una promesa central del producto, no un detalle técnico.

## Alternativas

- **Cuenta de comensal con login:** descartada por recoger datos personales innecesarios.
- **Identificación por teléfono para avisos:** descartada por el mismo motivo.
- **Login con redes sociales:** descartado por privacidad y por dependencia de terceros.
