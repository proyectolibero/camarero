---
id: ADR-0031
type: adr
title: El comensal anonimo entra por dos cerraduras minimas, y la aprobacion pasa a ser barrera de base
status: accepted
date: 2026-10-01
tags:
  - comensal
  - rls
  - seguridad
  - emparejamiento
  - fase-1
related:
  - ADR-0012
  - ADR-0013
  - ADR-0017
  - ADR-0019
  - CONTRACT-protocolo-mesa
  - CONTRACT-modelo-datos
  - D-008
  - LL-011
  - LL-022
  - TASK-F1-06
---

## Contexto

La investigacion del camino del comensal anonimo descubrio que no existe (no puede resolver el codigo de su mesa ni crear su sesion; es el mismo problema del huevo y la gallina que la migracion 0015 resolvio para el personal con dos cerraduras minimas) y, mas grave, que la aprobacion humana del emparejamiento NO es una barrera: la funcion que autoriza crear una comanda no mira el estado de la sesion ni si hay una solicitud aprobada. Es la promesa central del producto (D-008, CONTRACT-protocolo-mesa) y hoy es un acuerdo de pantalla.

## Decision

El comensal anonimo entra por DOS CERRADURAS MINIMAS, del mismo estilo que las que 0015 puso para el personal: una deja leer SOLO la fila de la mesa cuyo codigo se trae en el contexto, y otra deja crear SOLO la sesion de esa mesa y ese local. Ninguna lee otra tabla y ninguna usa funcion privilegiada: la primera lee el contexto y la segunda comprueba el contexto, de modo que no se cierra ningun ciclo de politicas. Y la APROBACION pasa a ser BARRERA DE BASE: crear una comanda exigira que la sesion este aprobada, no que alguien lo diga en una pantalla.

## Alternativas consideradas

1) Una funcion SECURITY DEFINER que resuelva el codigo y abra la sesion. Descartada: el proyecto ya pago caro un definer que lee como su dueno (LL-011) y la regla es no meter mas definers en el camino de la carta. Con dos cerraduras minimas queda mas estrecho y se puede probar sin privilegios.
2) Dar al borde un rol con BYPASSRLS para el camino del comensal. Descartada: es exactamente lo que ADR-0017 y 0015 quitaron de en medio.
3) Que el comensal lea la carta solo con el codigo de mesa, sin crear sesion. Descartada: la sesion de mesa es el objeto que ata el dispositivo, la aprobacion, la comanda y la cuenta. Sin ella no hay nada que aprobar ni que cerrar.
4) Dejar la aprobacion como acuerdo de pantalla, como estaba. Descartada: es la promesa central del producto y hoy no es cierta.

## Consecuencias

Se gana: el comensal funciona sin cuenta, la aprobacion pasa a ser una barrera que se puede probar, y no hace falta ninguna funcion privilegiada ni se cierra ningun ciclo de politicas. Se pierde: el borde tiene que fijar el contexto en el orden correcto, y equivocarse no da un error sino cero filas (un fallo silencioso, que es lo peor); por eso cada paso lleva su prueba. Y queda dicho con todas las letras: el identificador de sesion es, en la practica, la credencial del comensal, asi que va en cookie inalcanzable para el navegador y caduca. QUEDA PENDIENTE, y se decide con el problema delante en F2: el token de dispositivo (hoy no existe: la sesion es un token al portador) y el limite de intentos por dispositivo (la tabla de contadores no la puede usar el rol de la aplicacion).
