---
id: TASK-F1-06
type: task
title: "El comensal: su mesa, su carta y el emparejamiento aprobado de verdad"
status: done
date: 2026-10-01
phase: F1
tags:
  - comensal
  - qr
  - emparejamiento
  - rls
  - fase-1
related:
  - ADR-0023
  - ADR-0024
  - ADR-0031
  - CONTRACT-pantallas
  - CONTRACT-protocolo-mesa
  - D-008
  - LL-022
  - TASK-F1-03
  - TASK-F1-05
acceptance:
  - El comensal que escanea el QR de una mesa ve la carta de ESE local, sin cuenta y sin sesion
  - "El codigo de mesa resuelve SOLO esa mesa: un codigo inventado no resuelve nada, y con el contexto de una mesa no se ve la carta de otro local (se demuestra intentandolo)"
  - El identificador de sesion viaja en una cookie inalcanzable para el navegador y la sesion caduca
  - El comensal pide emparejarse y la solicitud queda pendiente; el comensal ve que esta esperando
  - Un empleado del local aprueba desde el panel; un empleado de OTRO local no puede aprobarla (se demuestra)
  - "La aprobacion es barrera de base: crear una comanda con una sesion NO aprobada falla, y se demuestra intentandolo"
  - Una solicitud caducada no se puede aprobar, y el comensal lo ve
  - El invariante de cero ciclos y el de funciones definer sin endurecer siguen pasando con las politicas nuevas
  - "Pruebas: resolver el codigo (y el codigo inventado), abrir sesion, leer la carta, no ver otro local, pedir emparejarse, aprobar, no poder aprobar desde otro local, y pedir sin aprobar falla"
  - "En vivo: el dueno escanea el QR de su mesa desde el telefono, ve su carta, pide emparejarse y lo aprueba desde el panel"
depends_on:
  - TASK-F1-05
doc: contracts/contract-protocolo-mesa-emparejamiento-de-mesa.md
tests:
  suite: pnpm test
  passed: true
  evidence: "2026-09-30 · pnpm test · workers/api 239 + packages/db 94 + tools/mcp-memory 95 = 428 pasan, 0 fallan. typecheck 0; biome ci 0. Aplicado en el Supabase real (19 migraciones, 29 tablas, 103 politicas). En vivo, de punta a punta y con el dedo del humano: escaneo el QR de su Mesa 1, vio su carta (HTTP 200), pulso pedir emparejarse, y lo aprobo desde el panel; la pantalla del comensal le respondio «Ya puedes pedir. El local aprobo tu mesa». Comprobado ademas contra la base real que el UPDATE de aprobacion afecta a 1 fila con el contexto del dueno (antes afectaba 0): esa fue la causa raiz del fallo, la politica de decision no incluia al dueno de la organizacion aunque la de lectura si."
---

## Descripcion

Rebanada 3 de la Fase 1: el comensal. Alguien escanea el QR de una mesa (que ya se imprime desde TASK-F1-03 y TASK-F1-04), ve la carta de ese local y pide emparejarse; un empleado lo aprueba desde el panel. Incluye la migracion con las DOS CERRADURAS MINIMAS del comensal anonimo y, sobre todo, convertir la aprobacion humana en una BARRERA DE BASE (ADR-0031, LL-022): hoy no lo es, y es la promesa central del producto. La primera version de la pantalla del comensal la dibuja el servidor (HTML), porque necesita la carta fresca y no necesita estado en el cliente; el service worker para leer sin cobertura vendra despues y no cambia este camino. NO incluye crear la comanda: es la rebanada siguiente; lo que si incluye es la BARRERA que la hara falta. NO incluye token de dispositivo ni limite de intentos: se deciden en F2 con el problema delante.

## Aceptacion

- [ ] El comensal que escanea el QR de una mesa ve la carta de ESE local, sin cuenta y sin sesion
- [ ] El codigo de mesa resuelve SOLO esa mesa: un codigo inventado no resuelve nada, y con el contexto de una mesa no se ve la carta de otro local (se demuestra intentandolo)
- [ ] El identificador de sesion viaja en una cookie inalcanzable para el navegador y la sesion caduca
- [ ] El comensal pide emparejarse y la solicitud queda pendiente; el comensal ve que esta esperando
- [ ] Un empleado del local aprueba desde el panel; un empleado de OTRO local no puede aprobarla (se demuestra)
- [ ] La aprobacion es barrera de base: crear una comanda con una sesion NO aprobada falla, y se demuestra intentandolo
- [ ] Una solicitud caducada no se puede aprobar, y el comensal lo ve
- [ ] El invariante de cero ciclos y el de funciones definer sin endurecer siguen pasando con las politicas nuevas
- [ ] Pruebas: resolver el codigo (y el codigo inventado), abrir sesion, leer la carta, no ver otro local, pedir emparejarse, aprobar, no poder aprobar desde otro local, y pedir sin aprobar falla
- [ ] En vivo: el dueno escanea el QR de su mesa desde el telefono, ve su carta, pide emparejarse y lo aprueba desde el panel

## Notas

- **2026-10-01** — Cerrada con la prueba en vivo del humano. Incluye: las dos cerraduras minimas del comensal (resolver la mesa por su codigo y abrir su sesion), la derivacion de la localidad desde la mesa para que no se cuele otra, la cookie inalcanzable para el navegador, la carta publica con fotos, la solicitud de emparejamiento, la pantalla de aprobacion y la APROBACION COMO BARRERA DE BASE (ADR-0031). DURANTE la prueba del humano aparecieron cuatro defectos mas, todos arreglados: (1) el dueno no podia aprobar, porque la politica de lectura admite el alcance de organizacion y la de escritura solo el de local, y org_owner no esta en la lista de personal de local (LL-024); (2) la ventana duraba 90 segundos y empezaba al escanear, no al pedir; (3) nada marcaba las caducadas; (4) el fallo no dejaba rastro y el mensaje culpaba a la caducidad. Correcciones en ADR-0032: quien ve una solicitud puede decidirla, la ventana dura 10 minutos y empieza al pedir, se renueva, se marca la caducada, toda decision deja rastro en auditoria, un local que no esta activo no abre mesas, y el fallo distingue sus causas. Se anadio la prueba que impide la recaida: quien puede ver una fila puede accionar sobre ella. Y un quinto defecto, encontrado por el arquitecto al verificar: un local sin abrir devolvia 404 (mentia sobre el codigo); ahora devuelve 503 con un mensaje honesto. PENDIENTE declarado: token de dispositivo y limite de intentos (F2), y la superficie /staff (hoy la aprobacion vive en el panel).
