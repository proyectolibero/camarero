---
id: TASK-F0-09
type: task
title: Armazon del panel y entrada del personal
status: todo
date: 2026-09-30
phase: F0
tags:
  - panel
  - autenticacion
  - armazon
  - fase-0
related:
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - ADR-0025
  - CONTRACT-pantallas
  - TASK-F0-04
acceptance:
  - GET /admin y /panel sin sesion devuelven el formulario de entrada, y con sesion devuelven el panel con el nombre del empleado
  - POST /admin/entrar con credenciales correctas deja una cookie con HttpOnly, Secure, SameSite=Lax y Path=/, y redirige al panel
  - "Con credenciales incorrectas la respuesta es identica a la de un correo que no existe: mismo codigo y mismo mensaje generico"
  - El pasaporte no aparece en ningun momento en el HTML ni en ningun script de la pagina
  - POST /admin/salir borra la cookie y devuelve a la entrada
  - Una ruta protegida sin sesion redirige a la entrada, y con un rol insuficiente muestra la pantalla de permiso denegado (no un error tecnico)
  - Toda mutacion de las pantallas nuevas entra por POST
  - "Tests: escapado por defecto de las plantillas (incluye comillas y etiquetas), banderas de la cookie, flujo de entrada contra un proveedor de identidad falso, y las rutas con y sin sesion"
  - "En vivo: el dueno del local de prueba entra en /admin con su cuenta real y ve su nombre, su rol y su local"
depends_on: []
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Construir el armazon de las pantallas dibujadas por el servidor (ADR-0023) y la entrada del personal (ADR-0024). Es la rebanada 0 de D-042 y el trabajo que cierra TASK-F0-04, que sigue esperando una prueba con un pasaporte real. Incluye: una unica manera de dibujar HTML con escapado por defecto; la piel compartida servida como hoja de estilos; la entrada (correo y contrasena) con el borde como intermediario ante el proveedor de identidad; la sesion en cookie inalcanzable para el navegador; la salida; la pantalla de permiso denegado; y el panel minimo que muestra quien eres, con el rol que tienes y tu local, con el hueco de las pantallas futuras. NO incluye ninguna pantalla de gestion: eso es la rebanada siguiente.

## Aceptacion

- [ ] GET /admin y /panel sin sesion devuelven el formulario de entrada, y con sesion devuelven el panel con el nombre del empleado
- [ ] POST /admin/entrar con credenciales correctas deja una cookie con HttpOnly, Secure, SameSite=Lax y Path=/, y redirige al panel
- [ ] Con credenciales incorrectas la respuesta es identica a la de un correo que no existe: mismo codigo y mismo mensaje generico
- [ ] El pasaporte no aparece en ningun momento en el HTML ni en ningun script de la pagina
- [ ] POST /admin/salir borra la cookie y devuelve a la entrada
- [ ] Una ruta protegida sin sesion redirige a la entrada, y con un rol insuficiente muestra la pantalla de permiso denegado (no un error tecnico)
- [ ] Toda mutacion de las pantallas nuevas entra por POST
- [ ] Tests: escapado por defecto de las plantillas (incluye comillas y etiquetas), banderas de la cookie, flujo de entrada contra un proveedor de identidad falso, y las rutas con y sin sesion
- [ ] En vivo: el dueno del local de prueba entra en /admin con su cuenta real y ve su nombre, su rol y su local
