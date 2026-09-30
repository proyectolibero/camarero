---
id: TASK-F0-09
type: task
title: Armazon del panel y entrada del personal
status: review
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

## Notas

- **2026-09-30** — Armazon construido y desplegado. Claves de contexto verificadas leyendo 0009_contexto_rls.sql: staff_actual() lee app.staff_id; org_actual() lee app.org_id; rol_actual() lee app.role; local_actual() lee app.location_id; en_mi_org(p) = es_org_owner() and p = org_actual() (app.role + app.org_id); es_platform_admin() = rol_actual() = 'platform_admin' (app.role); en_mi_local(p) usa app.role + app.staff_id + app.location_id. Ficheros NUEVOS: workers/api/src/ui/{html,estilos,respuesta}.ts, workers/api/src/panel/{sesion,proveedor,vistas,rutas}.ts, workers/api/tests/{html,panel}.test.ts. MODIFICADOS: base.ts (resolucion en una transaccion: claims -> fila staff -> app.* -> join orgs/locations), enrutador.ts (Entorno + SUPABASE_ANON_KEY, objeto de dependencias inyectable), auth/jwks.ts (tipo FuenteDeClaves), salud.ts (responderMetodoNoPermitido acepta metodos). Tests: workers/api 47 pasan (25 previos + 8 html + 14 panel), typecheck 0, biome ci 0 (30 infos preexistentes en tools/mcp-memory), packages/db 49 pasan (60.8s, Docker 29.6.1), wrangler deploy --dry-run compila. Commit 77b790e en main; CI 36753223726 success; Despliegue 36753315376 success. En vivo (camarero-api.proyectolibero.workers.dev): GET /admin 200 text/html con formulario; GET /panel 200; GET /panel/estilos.css 200 text/css cache public,max-age=3600; POST /admin/entrar con credenciales inventadas 401 (Content-Length 792) identico byte a byte al de un correo inexistente (mismo 401, mismo cuerpo con "Correo o contrasena incorrectos.", sin Set-Cookie); GET /admin/entrar 405 Allow:POST. CSP sin unsafe-inline ni unsafe-eval, con form-action 'self', base-uri 'none', frame-ancestors 'none', style-src 'self'; nosniff y HSTS presentes. NO VERIFICADO / PENDIENTE: SUPABASE_ANON_KEY no esta configurada como secreto del Worker (wrangler secret list solo lista SUPABASE_URL) y no dispongo del valor en el entorno; el codigo la lee y falla cerrado (login devuelve el mensaje generico), de modo que no se ha ejercitado un inicio de sesion real contra Supabase ni la aceptacion en vivo "el dueno entra y ve su nombre/rol/local". Tampoco se toca la RLS: si un rol no basta, se dibuja permiso denegado 403. No cierro la tarea.
