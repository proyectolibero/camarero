---
id: TASK-F1-06
type: task
title: "El comensal: su mesa, su carta y el emparejamiento aprobado de verdad"
status: todo
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
  passed: false
  evidence: null
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
