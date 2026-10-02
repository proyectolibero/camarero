---
id: TASK-F4-01
type: task
title: "El sistema visual: cinco modelos, la identidad del local como dato, y la carta como puerta de entrada"
status: todo
date: 2026-10-02
phase: F4
tags:
  - diseno
  - temas
  - comensal
  - piloto
  - fase-4
related:
  - ADR-0023
  - ADR-0027
  - ADR-0034
  - CONTRACT-pantallas
  - D-045
  - D-057
  - TASK-F1-12
acceptance:
  - "Existe packages/ui con los tokens (color, tipografia, espacio, radios, sombras, movimiento) y los componentes basicos (boton, tarjeta, insignia, formulario, aviso), y NINGUNA pantalla escribe un color a mano: todas usan tokens"
  - Hay CINCO modelos pre listos, y se pueden ver en una captura cada uno para elegir viendolos
  - "El local tiene su identidad como dato: modelo, color de acento, logo y portada; cambiarla no toca codigo"
  - "La carta del comensal es la puerta de entrada: portada, logo, nombre del local, la mesa, y las categorias como pestanas para saltar"
  - Cada plato se anade con un boton de pulgar, sin acertar en un enlace pequeno
  - La franja del gasto sigue visible y el desglose sigue a un toque (D-056)
  - El panel lleva el acento y el logo del local, sin perder la sobriedad de un backoffice
  - Lo que ve el usuario sigue sin una sola etiqueta script, y el contraste se mide con numero, no a ojo
  - Se ha medido el contraste de cada modelo y hay una prueba que se pone roja si alguien lo baja
  - "En vivo: el dueno abre su carta en el telefono, la ve con su identidad, y anade un plato"
depends_on:
  - TASK-F1-12
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Tramo 2 del camino al piloto (D-057): el sistema visual. Nace de la busqueda que pidio el humano y de su decision: «prefiero usar algo nuestro y que nosotros lo controlemos». Incluye packages/ui (tokens y componentes), CINCO modelos pre listos, la identidad del local como dato (modelo, acento, logo, portada), y la carta del comensal como puerta de entrada. Nada de dependencias visuales y nada de colores escritos a mano: si un color no sale de un token, esta mal. Los cinco modelos que aprobo el humano: Sobrio, Calido, Moderno, Nocturno y Verde.

## Aceptacion

- [ ] Existe packages/ui con los tokens (color, tipografia, espacio, radios, sombras, movimiento) y los componentes basicos (boton, tarjeta, insignia, formulario, aviso), y NINGUNA pantalla escribe un color a mano: todas usan tokens
- [ ] Hay CINCO modelos pre listos, y se pueden ver en una captura cada uno para elegir viendolos
- [ ] El local tiene su identidad como dato: modelo, color de acento, logo y portada; cambiarla no toca codigo
- [ ] La carta del comensal es la puerta de entrada: portada, logo, nombre del local, la mesa, y las categorias como pestanas para saltar
- [ ] Cada plato se anade con un boton de pulgar, sin acertar en un enlace pequeno
- [ ] La franja del gasto sigue visible y el desglose sigue a un toque (D-056)
- [ ] El panel lleva el acento y el logo del local, sin perder la sobriedad de un backoffice
- [ ] Lo que ve el usuario sigue sin una sola etiqueta script, y el contraste se mide con numero, no a ojo
- [ ] Se ha medido el contraste de cada modelo y hay una prueba que se pone roja si alguien lo baja
- [ ] En vivo: el dueno abre su carta en el telefono, la ve con su identidad, y anade un plato
