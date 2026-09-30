---
id: TASK-F1-05
type: task
title: "La carta: categorias, platos, bebidas y fotos"
status: todo
date: 2026-09-30
phase: F1
tags:
  - carta
  - fotos
  - bebidas
  - panel
  - fase-1
related:
  - ADR-0023
  - ADR-0030
  - CONTRACT-dinero
  - CONTRACT-modelo-datos
  - CONTRACT-pantallas
  - D-048
  - TASK-F1-04
acceptance:
  - El dueno crea, ordena y activa/desactiva categorias de su carta
  - El dueno crea platos y bebidas con nombre, descripcion, precio en pesos enteros, categoria, estacion (cocina o barra), alergenos, disponibilidad y orden
  - Se puede marcar un plato como no disponible sin borrarlo, y se distingue de un plato desactivado
  - Se puede DUPLICAR una ficha, para no teclear entera la ficha numero cincuenta de una carta de barra
  - "El precio es un entero de pesos chilenos: no se admite coma, ni decimal, ni negativo, y se valida en el servidor"
  - La foto se sube desde el panel, se guarda en R2 y se ve en la ficha del plato
  - "El borde SOLO acepta imagen raster (JPEG, PNG, WebP) comprobada por CONTENIDO: un SVG, o un fichero renombrado a .jpg que no sea una imagen, se rechaza con un mensaje claro"
  - La foto se sirve con su tipo de contenido fijo, nosniff, cache largo y CSP estricta
  - Sin sesion no se ve ni un dato de la carta; sin permiso no se crea ni se edita, y se comprueba con un caso real
  - Todo entra por POST, incluida la subida de la foto (multipart)
  - "Pruebas: categoria, plato, precio invalido (coma, negativo, texto), foto valida, un SVG rechazado, un .jpg que no es imagen rechazado, duplicar, sin sesion y sin permiso"
  - "En vivo: el dueno crea una categoria, un plato con su foto, y lo ve en su carta"
depends_on:
  - TASK-F1-04
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Rebanada 2 de la Fase 1: la carta. Categorias, platos y bebidas, con precio, alergenos, estacion de preparacion (cocina o barra), disponibilidad, orden y FOTO. Las fotos se suben a R2 y las sirve el borde, validando el contenido y rechazando el SVG (ADR-0030). Las bebidas son platos con estacion de barra, y una ficha tiene un solo precio (las dos tarifas de un vino llegan con los modificadores, F2): ver D-048. Se anade DUPLICAR porque una carta de barra puede tener cien referencias. NO incluye los modificadores ni los grupos de opciones: eso es F2.

## Aceptacion

- [ ] El dueno crea, ordena y activa/desactiva categorias de su carta
- [ ] El dueno crea platos y bebidas con nombre, descripcion, precio en pesos enteros, categoria, estacion (cocina o barra), alergenos, disponibilidad y orden
- [ ] Se puede marcar un plato como no disponible sin borrarlo, y se distingue de un plato desactivado
- [ ] Se puede DUPLICAR una ficha, para no teclear entera la ficha numero cincuenta de una carta de barra
- [ ] El precio es un entero de pesos chilenos: no se admite coma, ni decimal, ni negativo, y se valida en el servidor
- [ ] La foto se sube desde el panel, se guarda en R2 y se ve en la ficha del plato
- [ ] El borde SOLO acepta imagen raster (JPEG, PNG, WebP) comprobada por CONTENIDO: un SVG, o un fichero renombrado a .jpg que no sea una imagen, se rechaza con un mensaje claro
- [ ] La foto se sirve con su tipo de contenido fijo, nosniff, cache largo y CSP estricta
- [ ] Sin sesion no se ve ni un dato de la carta; sin permiso no se crea ni se edita, y se comprueba con un caso real
- [ ] Todo entra por POST, incluida la subida de la foto (multipart)
- [ ] Pruebas: categoria, plato, precio invalido (coma, negativo, texto), foto valida, un SVG rechazado, un .jpg que no es imagen rechazado, duplicar, sin sesion y sin permiso
- [ ] En vivo: el dueno crea una categoria, un plato con su foto, y lo ve en su carta
