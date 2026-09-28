---
id: ADR-0017
type: adr
title: El cierre de importes es un efecto del cambio de estado, con disparadores INVOKER y sin BYPASSRLS
status: accepted
date: 2026-09-28
tags:
  - dinero
  - rls
  - postgres
  - arquitectura
  - fase-0
related:
  - ADR-0008
  - ADR-0014
  - ADR-0015
  - D-039
  - RISK-018
  - LL-011
  - CONTRACT-dinero
  - CONTRACT-estados-comanda
---

## Contexto

ADR-0008 fijo que los importes se derivaban en disparadores BEFORE sobre la propia fila, dando por hecho que el comensal podia actualizar su comanda; se comprobo que no puede. ADR-0014 propuso cerrar los totales con un rol de servicio con BYPASSRLS; se comprobo que ese rol podia leer lineas de todas las organizaciones y reescribir totales ajenos. RISK-018 recogio que ambos describian mecanismos inviables. Con ADR-0015 y D-039 ya fijados (el camarero apunta desde su pantalla, una sola cuenta, subtotal sin descuento), hacia falta cerrar la integridad de importes sin BYPASSRLS y sin depender de que el comensal escriba nada.

## Decision

La comanda nace pendiente y con los importes a cero; al pasar a aceptada, un disparador BEFORE UPDATE cierra los importes (cada linea a su valor final con modificadores y cantidad, y la cuenta sumada, descartando cualquier descuento enviado por quien pide). El precio de linea y el delta de modificador se fijan en disparadores SECURITY INVOKER que leen la carta con la visibilidad del que pide. No se admiten lineas ni modificadores una vez aceptada, y ningun rol tiene BYPASSRLS.

## Alternativas consideradas

(A) ADR-0008: derivar los importes en un disparador BEFORE sobre la propia fila, con el comensal actualizando su comanda. Descartada porque parte de un supuesto falso: orders_update exige puede_operar (personal), asi que el UPDATE del comensal afecta a 0 filas y el disparador nunca se ejecuta. Verificado con experimento. (B) ADR-0014: cerrar con un rol de servicio con BYPASSRLS. Descartada porque la superficie no queda acotada: el rol necesita DML para que su funcion funcione, y eso le permite leer order_items de todas las organizaciones y reescribir totales de una comanda ajena. Verificado. (C) Una funcion de cierre que el borde invoca aparte. Descartada porque es una segunda llamada que se puede olvidar, y su olvido deja una comanda con lineas y total a cero. (D) Disparadores de precio y delta en SECURITY DEFINER con dueno superusuario, para que vieran la carta sin contexto. Descartada porque abre dos agujeros probados: un comensal puede valorar un plato de otra organizacion y saltarse el filtro de disponibilidad.

## Consecuencias

Gana: los importes se cierran dentro de la base en el momento en que el personal acepta la comanda, y el cierre no se puede olvidar porque es un efecto del cambio de estado, no una llamada aparte. No hay ningun rol con BYPASSRLS ni ninguna funcion que lea como un dueno privilegiado. Al ser los disparadores SECURITY INVOKER, la lectura de la carta y de las lineas hereda la visibilidad de quien actua: la RLS regala dos protecciones sin programarlas (no se puede valorar un plato de otro local ni uno agotado). Pierde: una comanda pendiente muestra importes a cero hasta que alguien la acepta, y no es pagable mientras tanto, cosa que hay que reflejar en la interfaz (el comensal ve que esta esperando aprobacion de cocina); y el cierre recorre las lineas de la comanda, que es coste aceptable por su tamano. Se asume a cambio de no introducir una capacidad peligrosa para un problema de dinero.
