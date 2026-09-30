---
id: ADR-0025
type: adr
title: El panel de plataforma existe con alcance minimo, y cada mirada a los datos de un cliente queda auditada
status: accepted
date: 2026-09-30
tags:
  - plataforma
  - permisos
  - seguridad
  - multi-tenant
related:
  - ADR-0022
  - ADR-0024
  - RISK-021
  - OQ-003
  - CONTRACT-pantallas
  - CONTRACT-modelo-datos
---

## Contexto

El humano pide "un backend con control total". Es una peticion legitima de operacion (dar de alta locales, suspender, dar soporte) pero concentra en una sola cuenta el acceso a todas las organizaciones: es el objetivo mas valioso de todo el sistema. Hay que decidir que puede y que no puede hacer antes de construir nada.

## Decision

Existe un panel de plataforma para el rol platform_admin, con alcance MINIMO: metadatos de organizaciones y locales (alta, suspension, plan) y estado de operacion. NO lee datos de negocio por defecto (cartas, comandas, cuentas). Ver los datos de un cliente es una accion explicita, temporal, con motivo escrito y registrada en el registro de auditoria inmutable, y la cerradura vive en la politica RLS, no en la pantalla.

## Alternativas consideradas

1) No tener panel de plataforma y operar a mano por SQL. Descartado: cada alta, suspension o consulta se convierte en un riesgo de error humano sobre la base de produccion, y no deja mas rastro que el que alguien escriba.
2) Panel de plataforma con acceso total a los datos de negocio. Descartado por RISK-021: concentra en una sola cuenta el acceso a todos los clientes y convierte cualquier descuido en una fuga entre locales.
3) Dar soporte usando la clave de servicio del proveedor. Descartado: esa clave SALTA la RLS, de modo que no habria ninguna cerradura mirando, y el rastro dependeria de que alguien lo apunte a mano.

## Consecuencias

Se gana: la operacion deja de ser SQL a mano, y una cuenta comprometida no alcanza los datos de ningun cliente. Se pierde: para diagnosticar un problema dentro de un local habra que pedir permiso y dejar constancia, lo que es mas lento. Mitigacion: el acceso temporal se disena desde el principio y se registra en audit_log, que ya es inmutable.
