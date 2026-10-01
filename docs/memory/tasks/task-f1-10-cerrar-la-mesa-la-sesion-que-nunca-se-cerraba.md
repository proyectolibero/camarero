---
id: TASK-F1-10
type: task
title: "Cerrar la mesa: la sesion que nunca se cerraba"
status: todo
date: 2026-10-01
phase: F1
tags:
  - sesion
  - sala
  - cierre
  - hallazgo
  - fase-1
related:
  - ADR-0031
  - ADR-0032
  - CONTRACT-protocolo-mesa
  - TASK-F1-06
  - TASK-F1-08
  - LL-022
  - LL-026
acceptance:
  - Una sesion de mesa se cierra sola tras cuatro horas sin actividad, como dice el contrato
  - Se puede cerrar una mesa a mano desde la sala, y la mesa vuelve a estar libre
  - "Con la sesion cerrada, el identificador deja de valer: un comensal de una sesion cerrada no puede pedir ni ver la carta"
  - "Cerrar deja rastro: quien lo cerro y cuando"
  - Una mesa que se cierra y se vuelve a abrir empieza limpia, sin las comandas del servicio anterior
  - La sala distingue una mesa ocupada de una que termino, y hay una prueba que pasa el tiempo (hoy todo se prueba con el dato fijo «sesion activa si»)
  - "Pruebas: cierre por inactividad, cierre a mano, la mesa vuelve a libre, el identificador cerrado no vale, y no se puede pedir en una sesion cerrada"
  - "En vivo: el dueno cierra una mesa desde la sala y la ve volver a estar libre"
depends_on:
  - TASK-F1-08
doc: contracts/contract-protocolo-mesa-emparejamiento-de-mesa.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Hallazgo H1 de la auditoria de la Fase 1, gravedad ALTA: LA SESION DE MESA NO SE CIERRA NUNCA. El unico sitio del repositorio donde aparece el estado `closed` es el `check` del esquema; ninguna migracion ni ningun fichero lo escribe, y no hay cron que cierre sesiones. Consecuencia: una mesa que se emparejo una vez se queda ocupada para siempre, la sala de TASK-F1-08 empieza a mentir desde el segundo servicio, y el identificador de sesion —que ADR-0031 declara «la credencial del comensal, y caduca»— no caduca en la base, solo la cookie. Ningun test lo cazo porque todos inyectan «sesion activa: si» como un dato fijo: un test que nunca ha pasado el tiempo. Incluye el cierre, el cierre a mano desde la sala, la invalidacion del identificador y el rastro. NO incluye el limite de intentos por dispositivo, que sigue pendiente de F2.

## Aceptacion

- [ ] Una sesion de mesa se cierra sola tras cuatro horas sin actividad, como dice el contrato
- [ ] Se puede cerrar una mesa a mano desde la sala, y la mesa vuelve a estar libre
- [ ] Con la sesion cerrada, el identificador deja de valer: un comensal de una sesion cerrada no puede pedir ni ver la carta
- [ ] Cerrar deja rastro: quien lo cerro y cuando
- [ ] Una mesa que se cierra y se vuelve a abrir empieza limpia, sin las comandas del servicio anterior
- [ ] La sala distingue una mesa ocupada de una que termino, y hay una prueba que pasa el tiempo (hoy todo se prueba con el dato fijo «sesion activa si»)
- [ ] Pruebas: cierre por inactividad, cierre a mano, la mesa vuelve a libre, el identificador cerrado no vale, y no se puede pedir en una sesion cerrada
- [ ] En vivo: el dueno cierra una mesa desde la sala y la ve volver a estar libre
