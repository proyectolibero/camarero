---
id: LL-030
type: lesson
title: Una tabla nueva sin ENABLE/FORCE ROW LEVEL SECURITY deja las politicas decorativas
status: recorded
date: 2026-10-02
tags:
  - rls
  - migraciones
  - seguridad
related: []
---

## Error

En la migracion 0024 cree table_notices con sus politicas y sin encender la RLS de la tabla. Las pruebas de aislamiento fallaron: un camarero de otro local veia el aviso ajeno y el comensal podia tocar el suyo, porque sin ENABLE/FORCE las politicas se crean pero no se aplican.

## Causa raiz

Se dio por hecho que la RLS se propagaba «sola» a las tablas nuevas. No: 0010 la activo tabla por tabla y 0021 la re-encendio explicitamente para las suyas. Una tabla creada despues no hereda ENABLE ni FORCE.

## Prevencion

Toda migracion que cree una tabla debe terminar con `alter table ... enable row level security` y `... force row level security`. La prueba `rls.test.ts` recorre TABLAS_DEL_CONTRATO y exige ambas (y al menos una politica): si se anade una tabla y no se registra ahi, el test tambien avisa. La cerradura que no se prueba no existe (LL-022).

## Detalle

Detectado por `packages/db/tests/avisos.test.ts` (cerraduras de aislamiento entre locales y entre mesas) antes de fusionar. Se corrigio en la misma migracion 0024.
