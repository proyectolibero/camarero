---
id: TASK-F1-03
type: task
title: El local, sus zonas, sus mesas y el QR para imprimir
status: review
date: 2026-09-30
phase: F1
tags:
  - panel
  - local
  - mesas
  - qr
  - fase-1
related:
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - ADR-0028
  - D-042
  - CONTRACT-pantallas
  - CONTRACT-modelo-datos
  - TASK-F0-09
acceptance:
  - El dueno ve los datos de su local y puede editarlos (nombre, zona horaria, estado y modo de servicio)
  - El dueno crea zonas y mesas desde el panel, sin guiones ni SQL
  - "El codigo de mesa se genera solo: 8 caracteres del alfabeto sin 0, O, 1 ni I, unico por local"
  - Cada mesa tiene una hoja imprimible con su QR y su codigo en grande, para dictarlo por telefono
  - El QR apunta al dominio configurado, nunca a una direccion escrita a mano en el codigo
  - La correccion del QR se demuestra con un vector conocido (un contenido fijo produce una matriz esperada), no solo con que se genere algo
  - Sin sesion no se ve ningun dato del local; un rol sin permiso no puede crear ni editar, y se comprueba con un caso real
  - Toda mutacion entra por POST, y los datos del formulario se validan en el servidor
  - "Pruebas: caso feliz, dato invalido, sin sesion, sin permiso, y la generacion del codigo de mesa"
  - "En vivo: el dueno crea una zona y una mesa desde su panel y ve su QR impreso en pantalla"
depends_on:
  - TASK-F0-09
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Rebanada 1 de la Fase 1 (D-042): el local y sus mesas. El dueno gestiona su local desde el panel: ve y edita sus datos, crea zonas (sala, barra, terraza, delivery) y mesas, y obtiene una hoja imprimible con el QR de cada mesa. El modelo de datos YA lo tiene previsto (CONTRACT-modelo-datos): tables.code es unico por local y de 8 caracteres en base32 sin 0, O, 1 ni I, porque se dicta por telefono; y zones.kind admite sala, barra, terraza y delivery. El QR se genera en el servidor como SVG (ADR-0028). NO incluye el alta de la organizacion: la primera organizacion la seguimos creando nosotros para el piloto, porque permitir que cualquiera cree una organizacion exige una puerta en la RLS que hay que diseñar con cuidado (va aparte, y con su propio ADR).

## Aceptacion

- [ ] El dueno ve los datos de su local y puede editarlos (nombre, zona horaria, estado y modo de servicio)
- [ ] El dueno crea zonas y mesas desde el panel, sin guiones ni SQL
- [ ] El codigo de mesa se genera solo: 8 caracteres del alfabeto sin 0, O, 1 ni I, unico por local
- [ ] Cada mesa tiene una hoja imprimible con su QR y su codigo en grande, para dictarlo por telefono
- [ ] El QR apunta al dominio configurado, nunca a una direccion escrita a mano en el codigo
- [ ] La correccion del QR se demuestra con un vector conocido (un contenido fijo produce una matriz esperada), no solo con que se genere algo
- [ ] Sin sesion no se ve ningun dato del local; un rol sin permiso no puede crear ni editar, y se comprueba con un caso real
- [ ] Toda mutacion entra por POST, y los datos del formulario se validan en el servidor
- [ ] Pruebas: caso feliz, dato invalido, sin sesion, sin permiso, y la generacion del codigo de mesa
- [ ] En vivo: el dueno crea una zona y una mesa desde su panel y ve su QR impreso en pantalla

## Notas

- **2026-09-30** — Inicio de la rebanada. Se implementa por trozos (local, zonas/mesas, QR) con verificacion y commit en cada uno. No se cierra: la prueba en vivo la hace el humano.

- **2026-09-30** — Tres trozos implementados y verificados (commits b669223, 9180600, 90710ed en main; CI y Despliegue en verde). Rutas /admin/local, /admin/zonas, /admin/mesas, /admin/mesas/<id>/qr, /admin/mesas/qr. Codigo de mesa en codigo-mesa.ts (base32 sin 0/O/1/I) con reintento por savepoint. QR SVG en ui/qr.ts; la decodificacion se comprueba con jsqr (solo pruebas): lee literalmente el contenido. RLS confirmada con 11 casos reales en packages/db/tests/panel-local.test.ts. No se cierra: la prueba en vivo la hace el humano.
