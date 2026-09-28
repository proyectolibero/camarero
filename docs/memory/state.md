---
id: state
type: state
title: "state — Fase 0 en curso: integridad de importes y alcance cerradas"
status: active
date: 2026-09-28
tags:
  - estado
  - fase-0
related:
  - ADR-0013
  - ADR-0016
  - ADR-0017
  - TASK-F0-07
  - CONTRACT-dinero
---

## Fase actual

**Fase 0 — Cimientos, EN CURSO.** La integridad de importes y las correcciones de alcance
estan cerradas y verificadas (`TASK-F0-07`). El rumbo de producto esta reescrito (ver
"Cambio de rumbo") y ya no hay contradicciones abiertas de dinero.

## Hecho y verificado

- **Memoria estructurada (MCP `camarero-memory`) operativa.** 13 herramientas, 95 tests
  propios en verde, 0 errores de integridad.
- **`TASK-F0-01` cerrada.** Repositorio publico con AGPL, pipeline (Biome + `tsc --strict` +
  Vitest + osv-scanner) y proteccion de rama. **0 vulnerabilidades.**
- **Esquema completo: 28 tablas** (0002–0007), UUIDv7 propio, 96 politicas,
  `FORCE ROW LEVEL SECURITY` en las 28, `audit_log` inmutable.
- **`RISK-017` cerrado.** Secuestro de ruta de busqueda por tabla temporal en la funcion de
  sesiones; arreglado en 0011 y verificado.
- **`TASK-F0-07` cerrada.** La integridad de importes, en tres trozos verificados:
  - **0012.** El precio y el nombre de cada linea, y el delta de cada modificador, los fija
    la base desde la carta. Disparadores **SECURITY INVOKER** (ver `LL-011`: un definer lee
    como su dueno y abre fuga entre organizaciones).
  - **0013.** La comanda nace `pendiente` con importes a cero; al pasar a `aceptada` se
    cierran los importes (cada linea a su valor final, la cuenta sumada, el descuento del
    cliente descartado). No se admiten lineas ni modificadores tras aceptar.
  - **0014.** Un encargado sin local alcanza los locales, la carta y las comandas de su
    organizacion; un camarero sin local no ve nada; un cobro solo se imputa a quien lo
    registra. Sin abrir el ciclo `locations -> table_sessions -> locations`.
  - **Ataque cerrado, verificado:** comensal con `discount_clp` igual al bruto y `total_clp`
    a cero, linea con precio 1 y modificador con delta 1; tras la aceptacion queda descuento
    0, subtotal 2000 y total 2000.
  - **`ADR-0017`** reemplaza a `ADR-0008` y `ADR-0014`, que describian mecanismos inviables
    (`RISK-018`).
- **137 tests en verde, 0 omitidos** (95 del MCP + 42 de base de datos), typecheck 0, linter 0.

## Reglas que ahora se comprueban solas

Tests de **propiedad** que avisan antes de llegar a `main`:

1. **Ninguna funcion `SECURITY DEFINER` sin endurecer** (search_path sin `public`,
   referencias cualificadas, y llamadas a funciones propias cualificadas: esto ultimo se
   amplio en `LL-010`).
2. **Ninguna politica RLS con ciclo**, ni directa ni transitivamente (`ADR-0012`, `ADR-0013`).

Los dos estan **probados como capaces de detectar los fallos reales**.

## Decisiones de producto ya fijadas

| Decision | Que fija |
|----------|----------|
| `ADR-0015` | El camarero apunta desde una pantalla propia (tablet barata o movil del local). Una sola cuenta. |
| `ADR-0016` | Camarero NO emite boletas: el local emite gratis en el SII y nosotros le damos los datos. |
| `D-038` | La integracion con TPV es una mejora opcional, no un requisito. |
| `D-039` | `subtotal` = suma de los platos; el descuento se resta; la propina va sobre lo descontado. |
| `D-040` | La pantalla arranca en un movil viejo y la tablet es el premio si funciona. |

Premisa del usuario: la mayoria de locales son pequenos y con sistemas rudimentarios.
**Somos los ultimos en llegar y nos adaptamos nosotros**, no exigimos que el local se adapte.

## Pendiente

- `TASK-F0-03` Cloudflare Pages + Workers con endpoint de salud.
- `TASK-F0-04` Supabase con autenticacion de personal y roles.
- `TASK-F0-05` Copias de seguridad semanales cifradas y ensayo de restauracion.
- `TASK-F1-01` Emparejamiento de mesa con aprobacion humana (espera a F0-03 y F0-04).
- `OQ-002` resuelta: TPV de barrio sin API (integracion descartada), tablets desde 90.000 CLP.

## Metodo de trabajo (aprendido a golpes)

> Escribir un trozo, **verificarlo con una prueba ejecutada**, y solo entonces escribir el
> siguiente. No acumular codigo sin verificar.

Cuatro fallos de la misma familia, todos apuntados: `LL-006` (BOM de PowerShell), `LL-009`
(diagnosticar el sintoma), `LL-010` (backtick en template literal que desconecto un test sin
avisar) y `LL-011` (SECURITY DEFINER lee como su dueno). Ninguno fue de logica: todos fueron
de suponer sin comprobar.

## Deuda conocida

- La proteccion de rama no bloquea los *pushes* directos del administrador.
- La proteccion no exige el check de Seguridad (hay 0 hallazgos: ya se puede endurecer).
- `pnpm test` exige Docker en la maquina de desarrollo.
- El borde y el comensal comparten un unico rol de base de datos.
- `ADR-0008` y `ADR-0014` siguen con estado `accepted` aunque `ADR-0017` los reemplaza; no
  se pueden editar (los ADR son inmutables), asi que la supersesion vive en `ADR-0017`.
- `D-037` contradice a `D-039`; prevalece `D-039`.

## Decisiones pendientes

- **Nombre definitivo de producto y dominio.**
- **Figura legal** antes de cobrar la primera cuota (`RISK-012`).
- **Cifras concretas de la cuota simbolica**, tras el primer piloto.
