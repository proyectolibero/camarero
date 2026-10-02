---
id: TASK-F1-13
type: task
title: Llamar al empleado y avisar de que la mesa necesita limpieza
status: todo
date: 2026-10-02
phase: F1
tags:
  - comensal
  - aviso
  - sala
  - piloto
  - fase-1
related:
  - ADR-0031
  - ADR-0035
  - CONTRACT-protocolo-mesa
  - D-053
  - D-057
  - TASK-F4-01
  - TASK-F1-10
acceptance:
  - El comensal puede LLAMAR A UN EMPLEADO desde su telefono, y ve que lo ha llamado
  - El comensal puede AVISAR de que la mesa necesita limpieza, y ve que lo ha avisado
  - La llamada LLEGA a la pantalla del personal, con la mesa y cuanto hace que se pidio
  - Alguien del local puede marcarla como atendida, y entonces desaparece de la lista
  - "Un comensal no puede inundar el local: como maximo hay UNA llamada viva de cada tipo por mesa, y se demuestra intentandolo"
  - Una llamada caduca sola si nadie la atiende, para que no se acumule basura de servicios anteriores
  - Un comensal de otra mesa no ve ni toca esta llamada, y un empleado de otro local tampoco
  - "Pruebas: llamar, avisar de limpieza, ver las llamadas el personal, atenderlas, el tope de una por tipo, la caducidad y el aislamiento"
  - "En vivo: el dueno llama al empleado desde el telefono y lo ve aparecer en su pantalla, y luego lo atiende"
depends_on:
  - TASK-F4-01
doc: contracts/contract-protocolo-mesa-emparejamiento-de-mesa.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Dos botones que el humano pidio para la pantalla del comensal: «llamar empleado» y «la mesa necesita limpieza». NO son solo botones: son dos avisos que tienen que LLEGAR a la pantalla del personal, con la mesa y el tiempo transcurrido, y que alguien del local tiene que poder marcar como atendidos. Hoy el esquema no tiene donde guardarlos, asi que hace falta sitio para ellos y sus cerraduras. Con tope de una llamada viva de cada tipo por mesa (para que un comensal no pueda inundar el local) y caducidad sola. Se construye DESPUES del sistema visual, para que los botones nazcan ya con la identidad del local.

## Aceptacion

- [ ] El comensal puede LLAMAR A UN EMPLEADO desde su telefono, y ve que lo ha llamado
- [ ] El comensal puede AVISAR de que la mesa necesita limpieza, y ve que lo ha avisado
- [ ] La llamada LLEGA a la pantalla del personal, con la mesa y cuanto hace que se pidio
- [ ] Alguien del local puede marcarla como atendida, y entonces desaparece de la lista
- [ ] Un comensal no puede inundar el local: como maximo hay UNA llamada viva de cada tipo por mesa, y se demuestra intentandolo
- [ ] Una llamada caduca sola si nadie la atiende, para que no se acumule basura de servicios anteriores
- [ ] Un comensal de otra mesa no ve ni toca esta llamada, y un empleado de otro local tampoco
- [ ] Pruebas: llamar, avisar de limpieza, ver las llamadas el personal, atenderlas, el tope de una por tipo, la caducidad y el aislamiento
- [ ] En vivo: el dueno llama al empleado desde el telefono y lo ve aparecer en su pantalla, y luego lo atiende
