---
id: TASK-F1-09
type: task
title: "Los puestos del local: los nombra el dueno y reparten la carta"
status: todo
date: 2026-10-01
phase: F1
tags:
  - puestos
  - carta
  - reparto
  - panel
  - fase-1
related:
  - ADR-0033
  - ADR-0034
  - CONTRACT-modelo-datos
  - CONTRACT-pantallas
  - D-048
  - LL-025
  - OQ-005
  - TASK-F1-07
acceptance:
  - El dueno crea, nombra, ordena y desactiva sus propios puestos, con los nombres de su local
  - Cada puesto dice si nace aceptado o si espera que alguien lo apruebe
  - Cada categoria de la carta tiene un puesto por defecto, y cada plato puede anularlo
  - "Un plato al que no le llega puesto por ningun lado no se queda sin destino: hay una regla clara y se dice en pantalla"
  - Al enviar, la comanda se reparte por el puesto REAL del plato, no por los cinco valores fijos del esquema
  - La comanda congela el identificador del puesto (para poder filtrar) y su nombre (para que renombrarlo no reescriba la historia)
  - Un local nuevo nace con un juego de puestos por defecto y funciona sin configurar nada
  - Las pantallas de trabajo pasan a ser por puesto del local, y sigue existiendo la que muestra todo junto
  - Los datos que ya existen se migran sin perderse ni duplicarse, y se demuestra
  - Sin sesion no se ve ni se toca nada de los puestos; un empleado de otro local tampoco
  - "Pruebas: crear y nombrar un puesto, la categoria manda, el plato anula, el reparto al enviar, el auto-aceptado por puesto, la migracion de los datos existentes y el plato sin destino"
  - "En vivo: el dueno crea un puesto con su nombre, lo asigna a una categoria, pide y ve la comanda llegar a la pantalla de ese puesto"
depends_on:
  - TASK-F1-08
doc: contracts/contract-modelo-datos-modelo-de-datos.md
tests:
  suite: pnpm test
  passed: false
  evidence: null
---

## Descripcion

Rebanada 6 de la Fase 1: los puestos pasan a ser datos del local. El dueno los nombra como habla su gente (parrilla, plancha, postre), decide cual nace aceptado, y reparte la carta de la categoria al plato. Hoy el reparto esta escrito en el codigo con cinco valores fijos, y la tabla `kitchen_stations` lleva desde la primera migracion vacia y sin usar (ADR-0034, LL-025). Incluye la migracion de los datos que ya existen. NO incluye las pantallas como agrupaciones configurables de puestos: eso es la rebanada siguiente, y aqui solo se pasa de rutas fijas a rutas por puesto del local, conservando la que muestra todo junto. NO incluye que un plato vaya a dos puestos a la vez (OQ-005).

## Aceptacion

- [ ] El dueno crea, nombra, ordena y desactiva sus propios puestos, con los nombres de su local
- [ ] Cada puesto dice si nace aceptado o si espera que alguien lo apruebe
- [ ] Cada categoria de la carta tiene un puesto por defecto, y cada plato puede anularlo
- [ ] Un plato al que no le llega puesto por ningun lado no se queda sin destino: hay una regla clara y se dice en pantalla
- [ ] Al enviar, la comanda se reparte por el puesto REAL del plato, no por los cinco valores fijos del esquema
- [ ] La comanda congela el identificador del puesto (para poder filtrar) y su nombre (para que renombrarlo no reescriba la historia)
- [ ] Un local nuevo nace con un juego de puestos por defecto y funciona sin configurar nada
- [ ] Las pantallas de trabajo pasan a ser por puesto del local, y sigue existiendo la que muestra todo junto
- [ ] Los datos que ya existen se migran sin perderse ni duplicarse, y se demuestra
- [ ] Sin sesion no se ve ni se toca nada de los puestos; un empleado de otro local tampoco
- [ ] Pruebas: crear y nombrar un puesto, la categoria manda, el plato anula, el reparto al enviar, el auto-aceptado por puesto, la migracion de los datos existentes y el plato sin destino
- [ ] En vivo: el dueno crea un puesto con su nombre, lo asigna a una categoria, pide y ve la comanda llegar a la pantalla de ese puesto
