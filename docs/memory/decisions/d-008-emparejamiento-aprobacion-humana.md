---
id: D-008
type: decision
title: "El emparejamiento de mesa requiere aprobacion humana"
status: accepted
date: 2026-09-27
tags: [producto, seguridad]
related: []
---

## Decision

Escanear el QR no abre nada por sí solo: el comensal solicita acceso y un empleado debe
aprobar el emparejamiento de la mesa. La sesión solo se activa con esa aprobación.

## Justificacion

Evita mesas fantasma y que alguien se auto-asigne una mesa a la que no pertenece. El código
de mesa de 8 caracteres es difícil de adivinar, pero la barrera real es la aprobación
humana del empleado.

## Alternativas

- **Apertura automática al escanear:** descartada por permitir acceso no autorizado y mesas
  fantasma.
- **Código de un solo uso sin aprobación:** descartado porque sigue sin verificar la
  presencia física.
- **Aprobación automática por geolocalización:** descartada por precisión insuficiente en
  interiores y por implicaciones de privacidad.
