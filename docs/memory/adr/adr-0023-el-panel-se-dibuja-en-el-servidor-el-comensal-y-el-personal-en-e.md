---
id: ADR-0023
type: adr
title: El panel se dibuja en el servidor; el comensal y el personal, en el navegador sin dependencias de terceros
status: accepted
date: 2026-09-30
tags:
  - panel
  - interfaz
  - arquitectura
  - rendimiento
related:
  - ADR-0022
  - ADR-0024
  - RISK-007
  - RISK-014
  - CONTRACT-pantallas
---

## Contexto

Hay que decidir quien dibuja las pantallas, porque condiciona las ~30 pantallas del inventario. El panel son formularios y listas; el comensal tiene que aguantar mala cobertura en un salon (la comanda debe poder guardarse y enviarse al recuperar la red) y la cocina tiene que enterarse de una comanda nueva al instante. El presupuesto es cero y el mantenedor es uno.

## Decision

El panel del dueno (/admin) y el de plataforma (/panel) los dibuja el SERVIDOR: el Worker devuelve HTML. El comensal (/t/...) y la pantalla del personal (/staff) son aplicaciones pequenas en el NAVEGADOR, sin dependencias de terceros, con el codigo minimo imprescindible (rutas, pintado, estado, cola de envio).

## Alternativas consideradas

1) Todo en el navegador, con una pieza de terceros (Svelte, Preact). Se escribe menos, pero mete una dependencia de terceros en produccion que hay que vigilar (RISK-014, RISK-009) y piezas que envejecen; ademas el panel son formularios y listas, que es justo lo que el servidor hace mejor.
2) Todo dibujado por el servidor, incluido el comensal. Descartado porque la PWA del comensal necesita guardar la comanda cuando no hay cobertura (outbox) y la cocina necesita enterarse al instante: ambas cosas exigen codigo en el navegador.
3) Todo hecho a mano en el navegador, incluido el panel. Descartado: escribir a mano un panel de gestion entero es el camino mas largo para una sola persona, y con mas superficie de error (montaje de formularios, estado, pintado).

## Consecuencias

Se gana: en el panel, cero dependencias en el navegador y la llave de sesion fuera de su alcance; en el comensal y la cocina, se gana funcionar sin cobertura y actualizarse al instante. Se pierde: conviven dos maneras de construir pantallas, y hay que ser disciplinado para que la piel no diverja. Mitigacion: los estilos y los componentes de presentacion viven en un paquete compartido, y cada superficie consume lo mismo.
