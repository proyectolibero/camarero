---
id: ADR-0029
type: adr
title: El mapa de mesas es visual y por cuadricula, dibujado en el servidor; el dibujo libre se pospone
status: accepted
date: 2026-09-30
tags:
  - panel
  - mesas
  - mapa
  - movil
  - fase-1
related:
  - ADR-0022
  - ADR-0023
  - ADR-0028
  - CONTRACT-pantallas
  - CONTRACT-modelo-datos
  - TASK-F1-03
  - D-042
---

## Contexto

El humano creo sus zonas y mesas y propuso, con razon, algo mas visual: poder dibujar la sala, la terraza o la barra segun el diseno real del establecimiento, recordando ademas que el personal trabaja en dispositivos moviles. Hoy las mesas son una lista. La pantalla que mas se va a usar no es la de diseno, sino la del personal viendo y tocando mesas decenas de veces al dia.

## Decision

El mapa de mesas es VISUAL, por cuadricula y dibujado en el SERVIDOR como SVG. Cada mesa ocupa una posicion en una cuadricula (fila y columna) que el dueno ajusta con botones grandes, sin arrastrar y sin JavaScript. El mapa del personal, que si se toca, corresponde a la superficie /staff, que ya es una aplicacion de navegador (ADR-0023). El dibujo libre —arrastrar, tamanos y giros— NO entra ahora.

## Alternativas consideradas

1) DIBUJO LIBRE desde el principio (arrastrar mesas, darles tamano, girarlas). Descartado POR AHORA, y con motivo: exige abrir JavaScript en el panel, que hoy no tiene ninguno por decision (ADR-0023), y es la pantalla que MENOS se usa — el dueno diseña su sala una vez y no la vuelve a tocar durante meses. En cambio la que se usa a diario es la del personal, que ya iba a ser una aplicacion de navegador. Poner la complejidad (y la excepcion de seguridad) en la pantalla de menos uso es un mal negocio.
2) Un editor por coordenadas (escribir numeros de fila y columna a mano). Descartado: nadie sabe que significa "fila 3, columna 7" hasta que lo ve, y el resultado es indistinguible del de mover con botones.
3) Seguir con la lista de mesas. Descartado: buscar "Terraza 1" en una lista de cuarenta mesas con el local lleno es justo lo que hay que evitar. La lista sigue existiendo para gestionar, pero no para mirar.

## Consecuencias

Se gana: el dueno ve su local de un vistazo y lo coloca como es en la realidad; el personal lo usara igual en el movil; y todo se dibuja en el servidor, sin abrir JavaScript en el panel ni relajar el CSP. Se pierde: una terraza con una forma rara no se reproduce pixel a pixel, solo por filas y columnas. Queda dicho a proposito: si el primer piloto pide dibujo libre, se tomara esa decision ENTONCES, con su propio ADR, sabiendo lo que cuesta (abrir JavaScript en el panel y ensanchar el CSP). No se abre esa puerta por si acaso.
