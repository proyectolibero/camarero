---
id: LL-028
type: lesson
title: "Las politicas RLS permisivas de UPDATE se combinan con OR: una nueva politica puede abrir una escalada"
status: recorded
date: 2026-10-01
tags:
  - rls
  - seguridad
  - postgres
  - fase-1
related: []
---

## Error

La prueba packages/db/tests/comensal.test.ts 'debe durar diez minutos y el comensal debe poder renovar la suya sin aprobarse' fallo con escalada = 1.

## Causa raiz

Creer que el WITH CHECK de una politica solo se aplica a las filas que esa misma politica hizo visibles. No es asi: USING y WITH CHECK se combinan por separado con OR entre politicas permisivas.

## Prevencion

Cuando una mutacion deba respetar el valor ANTERIOR de una columna, no basta una politica: hace falta un disparador BEFORE UPDATE que compare OLD y NEW. En table_sessions, camarero_comensal_no_escala_sesion impide que el comensal cambie estado, mesa, localidad u organizacion.

## Detalle

Al anadir la politica table_sessions_actividad_comensal (WITH CHECK state = 'active') para que el comensal marcara actividad en su sesion, un comensal con la sesion en 'pairing' pudo escribir state = 'active' y aprobarse la mesa solo. La prueba de comensal que ya existia lo cazo en la suite de base de datos. RLS evalua el USING y el WITH CHECK de cada politica permisiva y los combina con OR por separado: el USING de la politica de renovacion hizo visible la fila y el WITH CHECK de la de actividad admitio la fila nueva, aunque no fueran la misma politica.
