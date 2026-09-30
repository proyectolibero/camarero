---
id: LL-019
type: lesson
title: Un sondeo que solo exigia "que responda algo" daba por buena una respuesta 401
status: recorded
date: 2026-09-30
tags:
  - operacion
  - borde
  - sondeo
  - fase-0
related: []
---

## Error

El sondeo de API del keep-alive devolvia 401 de forma permanente y el codigo lo contaba como exito, porque no exigia un codigo concreto.

## Causa raiz

El sondeo se diseno como "basta con que responda", sin comprobar contra el sistema real que esa clase de clave fuera aceptada por ese endpoint. El endpoint raiz de la API REST exige una clave secreta, que por diseno no tenemos ni queremos tener, asi que devolvia 401 de forma permanente. Y como el codigo no exigia un 200, contabilizaba ese 401 como "la api respondio".

## Prevencion

Todo sondeo se prueba UNA VEZ contra el sistema real antes de darse por bueno, y exige una respuesta concreta (un 200 de un endpoint que existe y admite la credencial que usamos), nunca "que responda algo". Y con el sondeo de base ya verificado, queda claro cual es el que de verdad sostiene el keep-alive: ese, no el de API.

## Detalle

El keep-alive del borde hace dos sondeos: una consulta real a la base por Hyperdrive y una llamada a la API REST del proyecto. Al ejercitar los dos sondeos contra produccion por primera vez (antes solo estaban probados con sondeos inyectados) se descubrio que el segundo devolvia 401 con el mensaje "Secret API key required": el endpoint raiz de PostgREST solo admite claves secretas, y nosotros usamos la publishable. El sondeo de base, en cambio, respondio de verdad ("1" por el Session pooler con verify-full). Consecuencia: la mitad del keep-alive era decorativa y podia haber enmascarado una caida real de la API sin que nadie se enterara. Leccion de fondo: un sondeo que se conforma con cualquier respuesta no sondea nada. Hay que exigir una respuesta CONCRETA de un endpoint que exista y acepte la clase de credencial que tenemos.
