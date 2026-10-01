---
id: D-055
type: decision
title: El comensal ve lo que lleva gastado y en que va cada cosa; y el servicio se mide en toques
status: accepted
date: 2026-10-01
phase: F1
tags:
  - comensal
  - servicio
  - rapidez
  - producto
  - fase-1
related:
  - CONTRACT-estados-comanda
  - CONTRACT-pantallas
  - ADR-0033
  - D-039
  - TASK-F1-07
  - TASK-F1-11
---

## Decision

El comensal ve SIEMPRE tres cosas: que pidio, en que va cada cosa y CUANTO LLEVA GASTADO en la mesa. Su pantalla se refresca sola mientras hay algo en marcha y se para cuando ya no hay nada que contar. Y el servicio se mide en TOQUES: un puesto que no necesita aprobacion no obliga a tres confirmaciones. Los pasos que no aportan se quitan de la maquina de estados, no se esconden en la pantalla.

## Justificacion

El humano probo el flujo completo con el dedo y trajo cinco defectos. El mas grave es de informacion: aprobada la mesa, la pantalla del comensal dejaba de refrescarse, asi que veia «Enviada» para siempre y no sabia si su bebida se habia aceptado. Y el mas costoso en servicio: una bebida que solo hay que entregar exigia cuatro pasos entre aceptar y servir, cuando el local trabaja con las manos ocupadas y cada toque se paga. Su frase lo resume: «tenemos que tener en atencion el tiempo y la rapidez».

## Alternativas

1) Que el comensal recargue a mano cuando quiera saber algo. Descartado: el humano acaba de demostrar que no lo hace. Un comensal no recarga: mira, no ve cambio, y deja de mirar. La pantalla tiene que contar lo que pasa.
2) Refrescar la pantalla del comensal siempre, sin parar. Descartado: gasta bateria y datos en una mesa que ya termino, y deja la pantalla parpadeando sin motivo. Se refresca mientras hay algo en marcha y se para cuando ya no hay nada que contar.
3) Mantener la maquina de estados igual y poner un boton de «servida» solo para la barra. Descartado: seria una excepcion escondida en la pantalla. Los pasos que no aportan se quitan del modelo, no se esconden en la interfaz, para que la base y la pantalla digan lo mismo.
4) Un subtotal solo en el panel del dueno. Descartado: es el comensal el que necesita saber cuanto lleva antes de pedir mas; enterarse al final es justo lo que produce discusiones en la caja.
