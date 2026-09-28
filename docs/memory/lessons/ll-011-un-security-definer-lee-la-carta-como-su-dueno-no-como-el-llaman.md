---
id: LL-011
type: lesson
title: Un SECURITY DEFINER lee la carta como su dueno, no como el llamante, y eso abria fuga entre organizaciones
status: recorded
date: 2026-09-28
tags:
  - postgres
  - rls
  - security-definer
  - dinero
  - fase-0
related: []
---

## Error

El sembrado de rls.test.ts fallo y 24 tests quedaron skipped. Ademas, al probar la via de arreglo obvia (poner dueno superusuario) se comprobo con experimentos que abria dos agujeros: un comensal de una organizacion podia insertar una linea con el plato de OTRA organizacion y leer su nombre y precio, y podia pedir un plato agotado saltandose el filtro de disponibilidad que la politica si aplicaba al comensal. Es decir, el atajo para arreglar un fallo reabria una fuga entre inquilinos.

## Causa raiz

Escribi un disparador SECURITY DEFINER con dueno camarero_owner para que leyera la carta y fijara el precio de la linea. Razoné que, como camarero_owner no tiene BYPASSRLS, la lectura quedaria sujeta a la RLS del llamante. Eso es falso: en una funcion SECURITY DEFINER la lectura se evalua COMO EL DUENO de la funcion, no como el llamante. Funcionaba en el caso del comensal solo por casualidad, porque las politicas leen el contexto desde current_setting('app.*'), que es estado de sesion y sobrevive dentro de la funcion; en cuanto no hay contexto (sembrado de tests como admin, migracion de datos, backfill), la visibilidad divergia y la funcion fallaba con El plato no existe en ninguna carta.

## Prevencion

Un SECURITY DEFINER no hereda la visibilidad del llamante: hereda la del dueno. Antes de usarlo para leer datos sujetos a RLS, comprobar con un experimento quien ve que. Y como regla general: para un disparador que solo necesita leer la carta y copiar un valor, SECURITY INVOKER es lo correcto, porque hace que el disparador herede exactamente las protecciones de la RLS del que pide (solo su local, solo lo disponible) sin programar nada. Verificar siempre el caso sin contexto (sembrado, migracion de datos), no solo el caso nominal del comensal. Comprobado con experimento: con INVOKER, el mismo insert de un plato ajeno se rechaza, y el de un plato agotado tambien.
