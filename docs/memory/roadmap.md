---
id: roadmap
type: roadmap
title: "Hoja de ruta por fases y alcance"
status: active
date: 2026-09-27
tags: [roadmap, fases, alcance]
related: []
---

## Escala

1 desarrollador a tiempo completo, en semanas de 30 h efectivas. Cada fase tiene un
entregable usable: si el alcance posterior se rompe, lo ya construido sirve.

## Fase 0 — Cimientos (sem 1-2)

- **Objetivo:** dejar en pie el esqueleto tecnico del proyecto.
- **Entregable:** repositorio publico con CI verde, un local de prueba creado desde el
  panel y una mesa con QR que abre una PWA vacia.
- **Incluye:** monorepo pnpm + Biome + tsconfig estricto + ADR-0001; Supabase (dev y prod
  free), esquema inicial, RLS y migraciones; Cloudflare Pages, Workers, R2 y dominio; CI
  con biome, tsc, vitest y escaner de vulnerabilidades; primer test de humo de RLS;
  `/health`, Sentry y UptimeRobot.

## Fase 1 — Vertical minimo (sem 3-5)

- **Objetivo:** cerrar el primer flujo util de punta a punta.
- **Entregable:** un piloto real ya es posible; el producto minimo es utilizable.
- **Incluye:** emparejamiento de mesa con aprobacion (100 % testeado); carta basica
  (categorias, platos, precio, foto, alergenos, bilingue, disponibilidad); PWA del
  comensal instalable con offline en lectura y outbox en escritura; KDS minimo; panel del
  dueno minimo (crear local, carta, mesas, personal).

## Fase 2 — Comanda completa (sem 6-8)

- **Objetivo:** cubrir toda la toma de comanda.
- **Entregable:** comandas ricas con modificadores y toma desde el movil del camarero.
- **Incluye:** modificadores, notas, cantidades y anti-abuso completo; toma de comanda
  desde el movil del camarero; zonas, merge de mesas y mesas de barra; horarios, dias de
  cierre y modo cerrado; E2E de los flujos de emparejar/pedir y de comanda del camarero.

## Fase 3 — Cuenta (sem 9-10)

- **Objetivo:** repartir la cuenta sin errores de redondeo.
- **Entregable:** cuatro modos de reparto, propinas y descuentos con 100 % de cobertura.
- **Incluye:** `packages/domain` completo (4 modos de reparto, propinas, descuentos,
  cupones); solicitud de cuenta y pantalla de reparto; cierre de mesa y registro de cobro
  en `checkouts`; auditoria; E2E del flujo de reparto.

## Fase 4 — Personalizacion y operacion (sem 11-13)

- **Objetivo:** que un dueno pueda operar varias sedes.
- **Entregable:** panel del dueno completo, multi-local y copias de seguridad operativas.
- **Incluye:** panel completo (personal, roles, metricas, temas, logo, portada, banner);
  multi-local con cuota por sede; copias de seguridad semanales y ensayo de restauracion;
  E2E del KDS; publicacion de textos legales.

## Fase 5 — Delivery (sem 14-15)

- **Objetivo:** servir pedidos para retiro o entrega sin guardar datos del cliente.
- **Entregable:** cola de pedidos de delivery con alias anonimo.
- **Incluye:** `service_mode`, cola de pedidos, estados de preparacion y entrega, alias sin
  datos; E2E del flujo de delivery.

## Fase 6 — Pilotos (sem 16+)

- **Objetivo:** validar con locales reales y cerrar identidad y figura legal.
- **Entregable:** 1-3 locales usando el sistema 4 semanas, con metricas y ajustes.
- **Incluye:** landing y lanzamiento en redes; onboarding de locales (carta, mesas, QR,
  formacion); uso real con metricas; publicacion de codigo y documentacion. **Nada de
  funcionalidades nuevas aqui.**

## Fuera de alcance (consciente)

Pagos online, integracion con TPV, app nativa, impresion de tickets, programas de
fidelizacion, app del repartidor, rutas de reparto, propinas por empleado, multi-idioma
mas alla de es/en, facturacion electronica, on-premise y app del comensal con cuenta.

Cada uno es un proyecto en si mismo. Anotarlos aqui evita que se cuelen "por si acaso".
