---
id: TASK-F1-05
type: task
title: "La carta: categorias, platos, bebidas y fotos"
status: done
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
  passed: true
  evidence: "2026-09-30 · pnpm test · workers/api 209 + packages/db 72 + tools/mcp-memory 95 = 376 pasan, 0 fallan. pnpm typecheck 0; pnpm biome ci . 0. Revision VISUAL hecha sobre capturas generadas desde el codigo real (carta, ficha del plato y formulario de alta). En vivo: el dueno creo una bebida y un plato DESDE SU PANEL y confirma que funciona; y se corrigieron dos defectos de flujo que el mismo encontro al primer uso (la foto no se podia subir al crear, y para crear un plato habia que entrar en una categoria). La subida de la FOTO en produccion no se ha confirmado de forma expresa: lo que si esta probado es la validacion por contenido (SVG y falso .jpg rechazados), el limite de tamano, que una foto invalida NO crea el plato y conserva lo escrito, y el servicio de la imagen con su tipo de contenido correcto en lugar del HTML de la PWA."
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

## Notas

- **2026-10-01** — Cerrada con la prueba en vivo del dueno (bebida y plato creados y funcionando). Incluye: categorias con orden, renombrado y ocultado; platos y bebidas con precio entero de pesos, alergenos, estaciones reales (frio, caliente, bar, postre, bebidas), etiquetas, disponibilidad, orden y activo; duplicar; y las fotos subidas a R2 y servidas por el borde (ADR-0030) con validacion por CONTENIDO y rechazo del SVG. Decisiones: D-048 (las bebidas son platos con estacion de barra; las dos tarifas de un vino llegan con los modificadores) y D-049 (el alta se hace desde la carta, con la foto en el mismo formulario y con guardar y anadir otro). DOS TRAMPAS esquivadas: la ruta de la foto habria devuelto el HTML de la PWA si no se exime de run_worker_first (se eximio y se comprobo), y una captura de baja resolucion hizo creer al arquitecto que existia un segundo precio tachado que no existe (LL-021). Cosmética pendiente, declarada por el humano: se deja para el final. No incluye modificadores: es F2.
