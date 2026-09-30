---
id: CONTRACT-pantallas
type: contract
title: CONTRACT-pantallas — Superficies, permisos y convenciones del armazon
status: active
date: 2026-09-30
tags:
  - panel
  - interfaz
  - permisos
  - contrato
  - inventario
related:
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - ADR-0025
  - ADR-0017
  - CONTRACT-borde
  - CONTRACT-modelo-datos
  - RISK-007
  - RISK-021
---

## Las cuatro superficies

Todas sobre el mismo dominio, separadas por ruta y por politica de seguridad (`ADR-0022`).

| Superficie | Ruta | Quien entra | Como se dibuja | Sesion |
|-----------|------|-------------|----------------|--------|
| Comensal | `app.camarero…/t/<codigo>` | Cualquiera con el QR de una mesa | Navegador (`apps/web`) | **No tiene** |
| Personal | `/staff` | Empleado del local | Navegador (`apps/staff`) | Cookie |
| Dueno | `/admin` | Dueno o encargado | **Servidor** (Worker) | Cookie |
| Plataforma | `/panel` | Nosotros (`platform_admin`) | **Servidor** (Worker) | Cookie |

Que se dibuje en el servidor significa que el Worker devuelve el HTML (`ADR-0023`). La sesion
vive en una cookie que el navegador no puede leer (`ADR-0024`).

## Quien puede que

| Rol | Alcance | Puede |
|-----|---------|-------|
| (ninguno) | Comensal | Ver la carta de un local, pedir, llamar, pedir la cuenta |
| `server` | Su local | Aprobar emparejamientos, tomar comanda, ver mesas |
| `kitchen` | Su local | Ver el KDS, aceptar y marcar listo, anular |
| `location_manager` | Su local | Lo anterior + carta, mesas, QR y personal de su local |
| `org_owner` | Su organizacion | Todo lo de sus locales + ajustes y alta de locales |
| `platform_admin` | La plataforma | **Metadatos** de organizaciones y locales, y operacion |

**El rol NO da acceso por si solo: lo da la politica de la base.** La pantalla solo decide
que se dibuja; si alguien pide a mano una direccion que no le toca, la base no le devuelve
nada. Es la cerradura que ya existe (`CONTRACT-borde`, `ADR-0017`).

## Convenciones del armazon

Valen para toda pantalla, y son lo que hace que anadir una sea barato:

1. **Una ruta, una pantalla, una consulta, un permiso.** Si una pantalla necesita tres
   permisos distintos, son tres pantallas.
2. **Se escapa por defecto.** Ninguna plantilla escribe texto que venga de la base sin
   escapar. Es la regla que ya existe para el navegador, llevada al servidor.
3. **Toda mutacion es POST.** Nunca un enlace que cambie algo. Ademas de correcto, es lo
   que cierra el CSRF junto con la cookie marcada como no enviable entre sitios.
4. **Un error esperado se explica en la pantalla; uno inesperado no se disfraza.** Nada de
   "ha ocurrido un error" cuando el problema es un dato que falta.
5. **Ni un secreto ni un dato personal en el HTML.** El comensal es anonimo y el personal
   solo ve lo suyo.

## Inventario

| # | Superficie | Pantalla | Fase |
|---|-----------|----------|:----:|
| 1 | Comensal | Emparejamiento (QR y espera de aprobacion) | F1 |
| 2 | Comensal | Carta (categorias, platos, alergenos, disponibilidad) | F1 |
| 3 | Comensal | Ficha del plato (modificadores, notas, cantidad) | F1 |
| 4 | Comensal | Cesta y envio de comanda | F1 |
| 5 | Comensal | Estado de mis pedidos | F1 |
| 6 | Comensal | Llamar al camarero | F1 |
| 7 | Comensal | Pedir la cuenta y reparto | F3 |
| 8 | Comensal | Pedido de delivery (alias anonimo) | F5 |
| 9 | Personal | Entrada (correo y PIN de dispositivo) | F1 |
| 10 | Personal | Aprobar emparejamientos (el acto humano) | F1 |
| 11 | Personal | Mapa de mesas | F1 |
| 12 | Personal | KDS: comandas, aceptar, anular | F1 |
| 13 | Personal | Tomar comanda | F2 |
| 14 | Personal | Registrar cobro | F3 |
| 15 | Dueno | Entrada | **F0** |
| 16 | Dueno | Alta del local (asistente) | F1 |
| 17 | Dueno | Mesas, zonas y QR para imprimir | F1 |
| 18 | Dueno | Carta (categorias, platos, precios, fotos, orden) | F1 |
| 19 | Dueno | Personal (invitar, roles, PIN) | F1 |
| 20 | Dueno | Ajustes (tema, logo, horarios, modo de servicio) | F4 |
| 21 | Dueno | Pedidos e historico, anular | F4 |
| 22 | Dueno | Metricas | F4 |
| 23 | Dueno | Multi-local y cuota | F4 |
| 24 | Plataforma | Organizaciones y locales (alta, suspension, plan) | F1 |
| 25 | Plataforma | Ver como un cliente (motivo y auditoria) | F4 |
| 26 | Plataforma | Operacion: estado, errores, colas, copias | F0 |
| 27 | Plataforma | Metricas globales | F4 |

## Como se construye

**El armazon primero, las pantallas despues.** El armazon (una sola manera de dibujar, de
entrar y de comprobar permisos) se hace una vez; despues cada pantalla cuesta una tarde y
no una semana. El orden por fases esta en el roadmap y **no se adelanta**: un panel con
cuatro pantallas que funcionan vale mas que treinta a medias.
