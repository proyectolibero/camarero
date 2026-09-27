---
id: D-035
type: decision
title: Los estados de la comanda se nombran en espanol
status: accepted
date: 2026-09-27
phase: F0
tags:
  - comanda
  - estados
  - nomenclatura
related:
  - D-010
  - CONTRACT-estados-comanda
---

## Decision

Los estados de la comanda se nombran en espanol en todo el sistema: `pendiente`, `aceptada`, `preparando`, `lista`, `servida`, `cerrada`, `anulada`. El contrato de la memoria manda sobre PLAN.md.

## Justificacion

Las migraciones aplicadas (0005) ya usan los valores en espanol con su restriccion `check`, y son las que estan verificadas contra una base real. Cambiarlas ahora implicaria rehacer el esquema, los checks y el proximo paso (la RLS). Ademas el proyecto es de Chile y el personal de sala y cocina lee estos estados: en espanol son legibles para quien los usa a diario, en ingles son ruido. La memoria se escribio antes que las migraciones y manda: PLAN.md queda como documento de vision desactualizado en este punto.

## Alternativas

(A) Adoptar el ingles: cambiar el contrato y usar pending/accepted/preparing/ready/served/closed/voided en toda la base. Descartada porque PLAN.md es el documento de vision y la memoria es el contrato de trabajo; el codigo debe hablar el idioma del negocio, y el negocio es chileno. Ademas los estados aparecen en la UI del comensal, del KDS y del panel del dueno, y traducirlos en tres sitios para que suenen bien en espanol es trabajo repetido y una fuente de incoherencias. (B) Dejar la contradiccion y que cada capa use su idioma: descartada sin discusion, es exactamente el tipo de deriva silenciosa que la memoria existe para evitar.
