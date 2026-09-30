---
id: D-044
type: decision
title: El panel muestra el rol en palabras, y «server» se rotula «Garzón»
status: proposed
date: 2026-09-30
phase: F0
tags:
  - interfaz
  - panel
  - vocabulario
  - roles
related:
  - D-043
  - CONTRACT-pantallas
  - TASK-F1-02
---

## Decision

La pantalla nunca muestra el código interno del rol. Un único módulo (workers/api/src/panel/roles.ts) traduce los seis valores del check de 0003: platform_admin = «Administración de plataforma», org_owner = «Dueño», location_manager = «Encargado», server = «Garzón», kitchen = «Cocina» y no_pin = «Tablet compartida»; un rol desconocido muestra «Rol no reconocido». El glosario no fijaba el vocabulario del personal, así que esta decisión lo fija. Queda en estado proposed a la espera de que el humano confirme el término para server (Garzón frente a camarero o mesero).

## Justificacion

El humano miró /admin y vio «Rol: org_owner»: el código interno no significa nada para un hostelero, y D-043 exige que lo que ve el usuario vaya en español correcto. Para org_owner («Dueño») y location_manager («Encargado») la palabra ya estaba fijada en CONTRACT-pantallas; kitchen y no_pin salen del comentario de la migración 0003 (no_pin entra sin PIN a una tablet compartida). server es el único término en disputa: el repositorio usa «camarero», «mesero» y «garzón», el país piloto es Chile y tanto la descripción del proyecto («Garzon virtual») como TASK-F1-02 usan «garzón».

## Alternativas

1) server = «Camarero»: es el nombre del producto y el término más usado en la memoria (ADR-0015), pero rotular el rol igual que la aplicación crea ambigüedad («un Camarero dentro de Camarero») y no es el término que usa el hostelero chileno. 2) server = «Mesero»: aparece en overview y en RISK-010, pero es de uso latinoamericano genérico y menos local a Chile. 3) Dejar los códigos internos tal cual: descartado, es justo el defecto que el humano detectó y contradice D-043. 4) Traducir solo en el cuadro y no en la cabecera ni en la pantalla de permiso denegado: descartado, el código se colaría por otras dos vías (vistas.ts líneas 58 y 130).
