---
id: state
type: state
title: state — Fase 0 cerrada y Fase 1 en curso
status: active
date: 2026-09-30
tags:
  - estado
  - fase-0
  - fase-1
related:
  - ADR-0017
  - ADR-0021
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - ADR-0026
  - ADR-0027
  - D-042
  - D-043
  - D-045
  - TASK-F0-01
  - TASK-F0-03
  - TASK-F0-04
  - TASK-F0-05
  - TASK-F0-08
  - TASK-F0-09
  - TASK-F0-10
  - TASK-F1-01
  - TASK-F1-02
  - CONTRACT-borde
  - CONTRACT-pantallas
  - RISK-012
---

## Fase actual

**Fase 0 — Cimientos, CERRADA el 2026-09-30.**

**Fase 1 — Vertical mínimo, EN CURSO.** El objetivo es cerrar el primer flujo útil de punta a
punta: emparejamiento de mesa con aprobación humana, carta básica, PWA del comensal, KDS
mínimo y panel del dueño mínimo.

## Lo que ya funciona (y está comprobado)

- **Una sola dirección:** `https://camarero.proyectolibero.org`. El panel del dueño en
  `/admin` y el de plataforma en `/panel`; la PWA del comensal se sirve desde el mismo
  Worker como recursos estáticos (`ADR-0027`). El QR se imprimirá apuntando aquí y no
  cambiará nunca.
- **Base de datos:** 15 migraciones, 30 tablas y 98 políticas aplicadas en el Supabase real,
  con `FORCE ROW LEVEL SECURITY`. El borde conecta como `camarero_app`, que **no tiene
  BYPASSRLS y no es propietario de nada**.
- **Identidad, probada con un pasaporte real:** el dueño entró con su correo y su contraseña
  y vio su ficha. La firma se valida contra las claves públicas del proveedor (ES256, `ADR-0021`),
  la sesión vive en una cookie que el navegador no puede leer (`ADR-0024`) y con credenciales
  que no valen la respuesta es **idéntica byte a byte** a la de un correo que no existe.
- **Copias:** volcado semanal cifrado con `age` hacia R2, con retención de 4 semanales y 1
  mensual, **y un ensayo de restauración que se ejecuta de verdad** (restaura, compara contra
  el origen y se pone rojo si no cuadra). Comprobado que la copia es ilegible sin la clave y
  que el ensayo sabe fallar.
- **Keep-alive:** cron diario en el borde para que el proyecto no se pause (`ADR-0026`).
- **Memoria estructurada (MCP `camarero-memory`)** operativa, 0 errores de integridad.
- **209 pruebas en verde:** 61 del borde, 53 de base de datos y 95 del MCP. `typecheck` 0,
  `biome` 0. **0 alertas de CodeQL abiertas.**

## Tareas cerradas de la Fase 0

`F0-01` repositorio, CI y seguridad · `F0-02` esquema y RLS · `F0-03` el borde publicado ·
`F0-04` autenticación del personal · `F0-05` copias cifradas y ensayo · `F0-07` integridad de
importes y alcance · `F0-08` esquema aplicado en Supabase · `F0-09` armazón del panel.

## Reglas que ahora se comprueban solas

1. **Ninguna función `SECURITY DEFINER` sin endurecer**, ni llamadas a funciones propias sin
   cualificar (`ADR-0017`, `LL-010`, `LL-011`).
2. **Ninguna política RLS con ciclo**, ni directa ni transitivamente.
3. **La ortografía de lo que ve el usuario:** una palabra del panel sin tilde pone la suite en
   rojo (`D-043`, `LL-019`).
4. **El panel no muestra códigos internos:** el rol aparece en palabras, nunca como `org_owner`.
5. **Ningún sondeo se conforma con «que responda algo»:** un 401 cuenta como fallo (`LL-019`).

## Decisiones nuevas de esta fase

| Decisión | Qué fija |
|----------|----------|
| `ADR-0022` | Cuatro superficies sobre un mismo dominio, separadas por ruta y política de seguridad. |
| `ADR-0023` | El panel se dibuja en el servidor; el comensal y el personal, en el navegador. |
| `ADR-0024` | La sesión vive en una cookie inalcanzable para el navegador. |
| `ADR-0025` | El panel de plataforma existe con alcance mínimo y cada mirada queda auditada. |
| `ADR-0026` | El keep-alive vive en un cron del borde, no en GitHub. |
| `ADR-0027` | Un solo nombre de host servido por el Worker; Pages se retira. |
| `D-042` | Se congela el armazón antes que las pantallas y se respeta el orden del roadmap. |
| `D-043` | Todo texto nuevo va en español correcto, con tildes. |
| `D-045` | La palabra para el personal de sala es un dato del local, no una constante. |

## Deuda conocida

- `TASK-F0-10`: la tabla `prueba_runner` viaja a producción y `camarero_migraciones` vive en
  el esquema `public`.
- El proyecto de Pages sigue existiendo en Cloudflare, aunque ya no se publica en él.
- La protección de rama **no bloquea** los empujes directos del administrador, ni exige el
  check de Seguridad.
- `pnpm test` exige Docker en la máquina de desarrollo.
- El borde y el comensal comparten un único rol de base de datos.
- `ADR-0008` y `ADR-0014` siguen marcados como `accepted` aunque `ADR-0017` los reemplaza; los
  ADR son inmutables y así queda escrito.
- Cloudflare inyecta un script en línea (detecciones de JavaScript) que **nuestro CSP bloquea**:
  inofensivo, pero conviene decidir si se desactiva.
- El runbook de restauración **ensaya un PostgreSQL limpio, no un proyecto de Supabase nuevo**;
  esa parte está marcada como no ensayada.
- El primer latido del keep-alive aún no se ha observado.

## Decisiones pendientes

- **Nombre definitivo del producto** (la dirección ya es `camarero.proyectoliberio.org` y no
  se cambiará: los QR impresos no se tocan).
- **Figura legal** antes de cobrar la primera cuota (`RISK-012`).
- **Cifras concretas de la cuota simbólica**, tras el primer piloto.

## Método de trabajo (aprendido a golpes)

> Escribir un trozo, **verificarlo con una prueba ejecutada**, y solo entonces el siguiente.

Las lecciones acumuladas van de `LL-006` a `LL-019`, y casi todas son de la misma familia:
suponer sin comprobar. La última (`LL-019`) es la más reciente: un sondeo que solo exigía «que
responda algo» daba por bueno un 401.
