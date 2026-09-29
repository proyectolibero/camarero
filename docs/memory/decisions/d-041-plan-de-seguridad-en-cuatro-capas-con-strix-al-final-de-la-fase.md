---
id: D-041
type: decision
title: Plan de seguridad en cuatro capas, con Strix al final de la Fase 1
status: accepted
date: 2026-09-29
phase: F0
tags:
  - seguridad
  - ci
  - herramientas
  - fase-0
related:
  - CONTRACT-operacion
  - RISK-014
  - RISK-006
  - ADR-0018
---

## Decision

La seguridad se organiza en cuatro capas. Capa 1, en cada cambio: Biome, tipos estrictos, pruebas, los tests de invariantes (endurecimiento de funciones y ciclos de politicas) y OSV para dependencias; ya existe. Capa 2, gratis y activada ya: CodeQL para analisis estatico de seguridad, escaneo de secretos con bloqueo de subida (push protection) y OpenSSF Scorecard. Capa 3, por fase: una revision de seguridad adversarial del codigo de esa fase. Capa 4, al final de la Fase 1: Strix (pentesting autonomo con IA) como auditoria profunda, contra un entorno de pruebas desechable, con tope de gasto (--max-budget) y un modelo barato, ejecutada a mano y nunca en CI ni contra produccion.

## Justificacion

El usuario ha pedido reforzar la seguridad del codigo y ha propuesto Strix. Strix es una herramienta libre y seria (Apache-2.0, muy usada) que valida los fallos con pruebas de concepto reales, lo que la hace mejor que un escaner estatico al uso. Pero exige Docker y una clave de pago de un modelo de lenguaje, y su valor aparece cuando hay superficie real que atacar. Los guardianes gratuitos de GitHub (CodeQL, bloqueo de secretos, Scorecard) dan hoy mas valor por cero coste y tapan los fallos mas caros y mas irreversibles, como una clave filtrada en un repositorio publico, que no se puede borrar del historial. Dejar Strix para el final de la Fase 1 lo coloca cuando de verdad hay login, pedidos y mesas que auditar, y le pone tope de gasto para que no rompa el presupuesto cero.

## Alternativas

(A) Adoptar Strix ya, contra el repositorio y los dominios actuales. Descartada: Strix necesita una clave de pago de un modelo de lenguaje (cuesta dinero por escaneo) y hoy la superficie es un /health y una pagina estatica; pagar por auditar una casa vacia no aporta. (B) Meter Strix en CI en cada push. Descartada: coste por cada push, ruido de hallazgos y, sobre todo, un agente autonomo con acceso al CI es superficie de ataque nueva dentro de nuestra propia cadena. (C) Confiar solo en revision manual de codigo. Descartada: no escala con un mantenedor y no deja rastro. (D) Contratar un escaner comercial. Descartada: rompe el presupuesto cero. (E) Instalar Strix con el script oficial (curl | bash). Prohibida por nuestras propias reglas de seguridad: no se ejecuta un script remoto a ciegas. Si se usa, se instala con gestor de paquetes (pipx).
