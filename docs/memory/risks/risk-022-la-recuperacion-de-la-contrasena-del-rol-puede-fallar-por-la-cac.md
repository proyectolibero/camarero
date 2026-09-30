---
id: RISK-022
type: risk
title: La recuperacion de la contrasena del rol puede fallar por la cache del pooler justo despues de rotarla
status: open
date: 2026-09-30
tags:
  - operacion
  - supabase
  - pooler
  - recuperacion
  - fase-0
related: []
impact: medio
likelihood: media
---

## Riesgo

El workflow "Instalar esquema" hace ALTER ROLE ... PASSWORD (es la recuperacion prevista en RISK-020) y, acto seguido, abre una conexion como camarero_app para la comprobacion de aislamiento. Esa conexion inmediata puede recibir del pooler el verificador ANTERIOR y fallar con 28P01 "password authentication failed for user camarero_app". Paso dos veces seguidas al aplicar la limpieza del esquema; un diagnostico de solo lectura minutos despues autentico correctamente y la reejecucion quedo verde. No lo causa ningun cambio de esquema: el segundo intento aplico 0 migraciones y fallo igual. Consecuencia: el camino de recuperacion documentado puede parecer roto cuando en realidad solo va con retraso, y eso es peligroso en una emergencia.

## Evaluacion

- Probabilidad: media
- Impacto: medio

## Mitigacion

Reintentar la comprobacion de aislamiento con una espera breve (unos segundos y un par de intentos) dentro del propio workflow, para que la recuperacion de RISK-020 sea fiable. Y regla de lectura: un 28P01 inmediatamente despues de rotar una contrasena NO significa que la contrasena este mal; significa que el pooler todavia no se ha enterado. Nunca hay que diagnosticar una rotacion por el primer intento.
