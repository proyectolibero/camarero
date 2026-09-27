---
id: glossary
type: glossary
title: "Glosario y vocabulario ubicuo"
status: active
date: 2026-09-27
tags: [glosario, vocabulario]
related: []
---

- **comanda** — Conjunto de platos pedidos por una mesa o un camarero, con sus
  modificadores y notas. Es la unidad que viaja del cliente a cocina.
- **KDS** — Kitchen Display System. La pantalla de cocina donde el personal ve las
  comandas, cambia sus estados y puede anularlas.
- **emparejamiento de mesa** — Proceso por el que un dispositivo se vincula a una sesion
  de mesa. Requiere aprobacion humana de personal del local: un escaneo de QR no abre nada
  por si solo.
- **sesion de mesa** — Periodo durante el cual una mesa esta abierta y varios dispositivos
  pueden pedir. Se identifica con un alias y un token opaco, no con una identidad.
- **alias de mesa** — Nombre legible y efimero de la sesion (por ejemplo, "Mesa 4"), sin
  relacion con ninguna persona. Cada visita empieza de cero.
- **local / sede** — Un establecimiento fisico de hosteleria. Un mismo dueno puede tener
  varias sedes agrupadas bajo una misma organizacion.
- **org** — Organizacion. Agrupa los locales de un mismo dueno. Todas las tablas llevan
  `org_id` directa o indirectamente y RLS por organizacion.
- **cuenta dividida** — Reparto del total de una cuenta entre varios comensales. Admite
  cuatro modos: por items, equitativo, a medias y manual. Ver `CONTRACT-dinero`.
- **propina sugerida** — Porcentaje opcional (0/5/10/15/20 %) que el comensal elige y que
  el sistema presenta al personal para que lo aplique en el TPV. El 100 % es del local.
- **TPV** — Terminal Punto de Venta del local. Es donde el personal cobra. El dinero nunca
  pasa por nosotros: solo se registra que un empleado del local marco un cobro.
- **cola de delivery** — Filtro del mismo sistema para pedidos de retiro o entrega. No pide
  emparejamiento de mesa, usa un alias anonimo y el local gestiona la entrega por su canal.
- **gate de rigor** — Verificacion bloqueante que impide cerrar una tarea sin criterios de
  aceptacion, tests en verde con evidencia, documento asociado y dependencias cerradas.
  Ver `ADR-0007`.
- **memoria** — La fuente de verdad del desarrollo del proyecto: documentos markdown
  versionados en git bajo `docs/memory`, validados por el MCP `camarero-memory`.
- **MCP** — Model Context Protocol. El protocolo por el que los agentes leen y escriben la
  memoria a traves del servidor `camarero-memory`.
- **PWA** — Aplicacion web instalable que se abre desde una URL sin friccion. Es el unico
  cliente del producto (comensal, personal y panel del dueno).
- **RLS** — Row Level Security de Postgres. Regla de aislamiento por fila activada y
  probada en cada tabla. Un test por tabla falla si falta la politica.
- **outbox** — Cola local (IndexedDB) donde la PWA guarda una comanda cuando no hay red,
  para reintentarla despues con idempotencia.
- **ADR** — Architecture Decision Record. Documento append-only que fija una decision de
  arquitectura y las alternativas que se descartaron.
