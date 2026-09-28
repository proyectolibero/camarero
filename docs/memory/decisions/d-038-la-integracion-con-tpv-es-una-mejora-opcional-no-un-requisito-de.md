---
id: D-038
type: decision
title: La integracion con TPV es una mejora opcional, no un requisito del producto
status: accepted
date: 2026-09-28
phase: F1
tags:
  - producto
  - integracion
  - tpv
  - alcance
related:
  - D-004
  - ADR-0015
---

## Decision

El sistema funciona sin ningun TPV y sin ninguna integracion. Cuando el local tenga un TPV de nube con API publica (hoy: Toteat; y Fudo en su plan Pro), se puede enviar tambien la comanda al TPV como mejora. La integracion no es requisito para que el producto funcione, no se promete con el TPV del barrio sin investigarlo antes, y el cobro y la boleta siguen siendo enteramente del local.

## Justificacion

La investigacion mostro que los productos que sobreviven se integran con el TPV del local, y que no integrarse agrava la cuenta partida. Eso hizo pensar en integrarse como via principal. Pero el usuario ha fijado que el local tipico tiene sistemas rudimentarios sin API, y que somos los ultimos en llegar: depender de la API de un tercero nos deja fuera del mercado que queremos atender y nos ata a un proveedor. Con el modo camarero como via base (ADR-0015), la cuenta completa ya vive en nuestro sistema, asi que la integracion pasa a ser un extra que anade comodidad al local moderno, no una pieza de la que dependa la correccion del producto. Esta decision matiza y reemplaza el alcance de D-004, que descarto toda integracion en el MVP.

## Alternativas

(A) Integracion obligatoria con el TPV como via principal: dejaria fuera a los locales sin API y contradice la premisa del local rudimentario. (B) Mantener D-004 tal cual, sin integracion nunca: cierra una via de valor barata para los locales modernos y renuncia a la unica integracion que la investigacion demuestra viable. (C) Prometer integracion con 'el TPV del barrio' sin haberlo investigado: seria inventar un dato; hay que investigar primero los TPV instalados en local, no solo los de nube.
