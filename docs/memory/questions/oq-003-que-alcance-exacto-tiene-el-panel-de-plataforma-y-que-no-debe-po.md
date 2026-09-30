---
id: OQ-003
type: question
title: Que alcance exacto tiene el panel de plataforma y que NO debe poder hacer
status: open
date: 2026-09-30
tags:
  - panel
  - plataforma
  - permisos
  - fase-1
related: []
---

No existe hoy ninguna pantalla ni diseno para la administracion de plataforma (nosotros), aunque el modelo de datos ya reserva el rol platform_admin en staff.role. Hay que decidir: que puede hacer (dar de alta organizaciones, suspenderlas, ver soporte, metricas globales), que NO puede hacer (leer datos de negocio de un local sin dejar rastro), y como se registra cada acceso. Hoy la unica puerta de identidad es el JWKS mas la fila de staff, asi que plataforma es una fila mas con rol platform_admin: la cerradura fina habra que escribirla.
