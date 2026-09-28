---
id: RISK-019
type: risk
title: Que el primer local pida integrarse con su TPV o que le emitamos la boleta, y lo hagamos
status: open
date: 2026-09-28
tags:
  - alcance
  - integracion
  - boleta
  - producto
  - gobierno
related: []
impact: medio
likelihood: alta
---

## Riesgo

Acabamos de cerrar dos vias de integracion (TPV de barrio y emision de boletas) por razones solidas: no hay API publica en los POS instalados y la ley chilena no permite que un tercero sin certificacion emita boletas en nombre de otro. El riesgo es que, con el primer local en marcha, llegue la peticion 'oye, y por que no te conectas a mi TPV' o 'y por que no me sacas la boleta tu'. Si eso entra en el producto por la puerta de atras, volvemos al trabajo por cliente, al alcance que crece sin control (RISK-007) y a responsabilidades que no podemos sostener con un mantenedor y presupuesto cero. La decision ya esta tomada y argumentada (ADR-0016, D-038, D-040); el riesgo es que se erosionen sin que nadie lo note. La mitigacion no es tecnica: es responder con los hechos de la investigacion en mano y, si el local lo necesita de verdad, derivarlo a un proveedor certificado a cuenta del local. Toda peticion de integracion debe exigir un ADR nuevo que reemplace a los anteriores, nunca una excepcion informal en el codigo.

## Evaluacion

- Probabilidad: alta
- Impacto: medio

## Mitigacion

Ante cualquier peticion de integracion con TPV o de emision de boletas: responder con la investigacion (no hay API en los POS instalados; el SII exige que el emisor sea el local), ofrecer la alternativa de coste cero (datos preparados para el portal gratuito del SII, via futuro con proveedor certificado a cuenta del local), y exigir un ADR que reemplace ADR-0016, D-038 y D-040 antes de escribir una sola linea. Nunca por excepcion informal.
