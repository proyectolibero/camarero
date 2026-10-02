---
id: D-057
type: decision
title: "El camino al primer piloto: funcionar y asegurar, despues el sistema visual, y solo entonces los locales"
status: accepted
date: 2026-10-02
phase: F1
tags:
  - rumbo
  - piloto
  - diseno
  - producto
related:
  - D-042
  - D-043
  - D-045
  - CONTRACT-pantallas
  - ADR-0034
  - TASK-F1-12
  - TASK-F3-01
---

## Decision

El camino al primer piloto tiene TRES tramos en este orden: (1) poner TODO EN FUNCIONAMIENTO, con los tests de seguridad en verde; (2) el SISTEMA VISUAL, con la identidad del local configurable y la carta del comensal como puerta de entrada; (3) los LOCALES PILOTO. Lo configurable es la identidad del local y su organizacion del trabajo, NO la estructura de la interfaz. Y el rediseno visual se hace sobre un sistema unico, pantalla a pantalla, mirando cada una (LL-020).

## Justificacion

El humano ha fijado el rumbo para llegar a una prueba real: primero que todo funcione con la seguridad probada, despues que sea atractivo y configurable, y solo entonces buscar locales. El orden es correcto y ademas protege lo mas valioso: un local piloto que entra y encuentra fallos no vuelve, y solo hay una oportunidad con el primero. La condicion que pongo es acotar las dos frases abiertas —«lo mas atractivo posible» y «totalmente configurable»— porque sin acotar se comen el presupuesto de un mantenedor. Lo que falta para que el flujo entero exista es la CUENTA: hoy el comensal puede pedir pero no puede pedir la cuenta ni el local puede registrar el cobro.

## Alternativas

1) Rediseñar lo visual primero y dejar la funcionalidad para despues. Descartado: una carta preciosa que no sabe pedir la cuenta no sirve para un local real, y el propio humano ha dicho que primero hay que poner todo en funcionamiento con la seguridad probada.
2) Hacer «todo configurable», incluida la estructura de las pantallas. Descartado: eso es un constructor de paginas, y un constructor de paginas es un producto dentro del producto. Lo que se configura es la IDENTIDAD del local (colores, logo, portada, su vocabulario) y su organizacion del trabajo (puestos, pantallas, carta). La estructura de la interfaz la decidimos nosotros, que para eso la probamos.
3) Rediseñar pantalla a pantalla «a ver que sale». Descartado: sin sistema, cada pantalla se vuelve a inventar y a las diez pantallas hay cinco estilos. El sistema visual vive en un solo sitio y se aplica desde ahi.
4) Buscar locales de prueba antes de terminar. Descartado por el humano y con razon: un local que entra y encuentra fallos no vuelve.
