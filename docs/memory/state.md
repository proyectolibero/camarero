---
id: state
type: state
title: state — Fase 0 cerrada y Fase 1 practicamente entregada, con fiscal
status: active
date: 2026-10-01
tags:
  - estado
  - fase-1
  - fiscal
related:
  - ADR-0017
  - ADR-0021
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - ADR-0026
  - ADR-0027
  - ADR-0028
  - ADR-0030
  - ADR-0031
  - ADR-0032
  - ADR-0034
  - D-042
  - D-043
  - D-045
  - D-051
  - D-053
  - D-054
  - TASK-F0-01
  - TASK-F0-03
  - TASK-F0-04
  - TASK-F0-05
  - TASK-F0-08
  - TASK-F0-09
  - TASK-F0-10
  - TASK-F1-06
  - TASK-F1-09
  - TASK-F1-10
  - CONTRACT-borde
  - CONTRACT-pantallas
  - CONTRACT-protocolo-mesa
  - LL-020
  - LL-021
  - LL-022
  - OQ-005
  - RISK-012
---

## Fase actual

**Fase 0 — Cimientos, CERRADA el 2026-09-30.**

**Fase 1 — Vertical mínimo, prácticamente entregada.** El primer flujo útil funciona de punta a punta: el comensal escanea un QR, ve la carta, pide emparejarse, **un empleado lo aprueba**, pide, y **la comanda llega al puesto que le toca**. Queda cerrar el visto bueno del humano sobre lo último y auditar de nuevo.

## Lo que ya funciona (y está comprobado)

- **Una sola dirección:** `https://camarero.proyectolibero.org`. El panel del dueño en `/admin`, el de plataforma en `/panel` y la pantalla del comensal en `/t/<código>`, todo servido por el mismo Worker (`ADR-0027`). El QR se imprime apuntando aquí y no cambiará nunca.
- **Base de datos:** **22 migraciones, 29 tablas y 105 políticas** aplicadas en el Supabase real, con `FORCE ROW LEVEL SECURITY`. El borde conecta como `camarero_app`, que **no tiene BYPASSRLS y no es propietario de nada**.
- **El local:** el dueño ve y edita su local, crea zonas y mesas, las coloca en un **mapa visual** sin una línea de JavaScript, y obtiene **hojas de QR imprimibles**. El código de mesa (8 caracteres sin `0`, `O`, `1` ni `I`) se dicta por teléfono sin equivocarse.
- **La carta:** categorías, platos y bebidas con precio entero, alérgenos, disponibilidad y **fotos** (subidas a R2, validadas **por contenido** y servidas por el borde: el SVG se rechaza siempre). Duplicar, para una carta de barra de cien referencias.
- **El comensal:** ve la carta de **su** mesa sin cuenta ni sesión, pide emparejarse, y **no puede ver la carta de otro local** (probado). Su sesión vive en una cookie que el navegador no puede leer y **se cierra sola tras 4 h sin actividad** (`TASK-F1-10`).
- **La aprobación humana es barrera de base**, no un acuerdo de pantalla: sin sesión aprobada, la comanda **falla** (`ADR-0031`). Quien puede ver una solicitud puede decidirla (`ADR-0032`, `LL-024`).
- **La comanda se reparte por puesto**: la cesta se parte en una comanda por destino, la cocina **no ve precios ni bebidas**, y los puestos **los nombra el dueño** (`ADR-0034`). Una bebida nace aceptada, porque su protección es que el local puede anularla.
- **La sala** muestra todas las mesas con sus estados, sin importes, y permite aprobar emparejamientos y cerrar mesas.
- **Identidad, probada con un pasaporte real:** la firma se valida contra las claves públicas del proveedor (ES256, `ADR-0021`); con credenciales que no valen la respuesta es **idéntica byte a byte** a la de un correo que no existe.
- **Copias:** volcado semanal cifrado con `age` hacia R2, **con ensayo de restauración que se ejecuta de verdad** y que se ha comprobado capaz de fallar. La copia es ilegible sin la clave.
- **Keep-alive** diario para que el proyecto no se pause (`ADR-0026`).
- **571 pruebas en verde:** 327 del borde, 133 de base de datos, 16 del dominio y 95 de la memoria. `typecheck` 0, `biome` 0 errores. **0 alertas de CodeQL abiertas.**

## El fiscal

Desde el 2026-10-01 el proyecto tiene un **agente fiscal independiente** (`.opencode/agent/fiscal.md`): comprueba lo que otro construyó, reproduce la evidencia, caza las familias de fallo ya conocidas y emite veredicto. **No puede arreglar nada** (sus permisos se lo impiden). En su primera auditoría completa de la Fase 1 encontró ocho hallazgos, entre ellos que **la sesión de mesa no se cerraba nunca** y que un contrato prometía barreras inexistentes.

## Reglas que ahora se comprueban solas

1. **Ninguna función `SECURITY DEFINER` sin endurecer**, ni llamadas propias sin cualificar.
2. **Ninguna política RLS con ciclo**, ni directa ni transitivamente.
3. **Quien puede ver una fila puede accionar sobre ella** (`LL-024`).
4. **La ortografía de todo lo que ve el usuario**, en todas las pantallas, incluidas las del comensal (`D-043`).
5. **Ningún sondeo se conforma con «que responda algo»:** un 401 cuenta como fallo (`LL-019`).
6. **El panel no tiene ni una etiqueta `script`.**
7. **Ni un importe donde no toca:** ni en la cocina, ni en la sala, ni en las pantallas de puesto.
8. **La migración no pierde datos**, y hay una prueba que siembra un estado anterior y compara después.

## Tareas de la Fase 1

Cerradas: `F1-03` (el local y el QR) · `F1-04` (el mapa) · `F1-05` (la carta) · `F1-06` (el comensal y el emparejamiento).
Entregadas y auditadas, pendientes del visto bueno del humano: `F1-07` (la comanda) · `F1-08` (la sala) · `F1-09` (los puestos).
En curso: `F1-10` (cerrar la mesa).
Pendientes: `F1-01` (el emparejamiento original, alineado con `ADR-0032`) y `F1-02` (la entrada por PIN del personal).

## Deuda conocida

- **El identificador de sesión es un token al portador**: no está atado a un dispositivo, y no hay límite de intentos ni de envíos. Es el hueco consciente más grande del protocolo (`ADR-0031`); se cierra en F2 con el token de dispositivo.
- El **proyecto de Pages** sigue existiendo en Cloudflare, aunque ya no se publica en él.
- La **protección de rama no bloquea** los empujes directos del administrador, ni exige el check de Seguridad.
- `pnpm test` **exige Docker** en la máquina de desarrollo y tarda unos **200 segundos** (la convención dice 60).
- El borde y el comensal comparten un **único rol de base de datos**.
- **Cloudflare inyecta un script** (detecciones de JavaScript) que nuestro CSP **bloquea**: inofensivo, pero conviene decidir si se desactiva.
- El runbook de restauración **ensaya un PostgreSQL limpio, no un proyecto de Supabase nuevo**.
- La superficie `/staff` (la pantalla del personal en su propio sitio) todavía no existe: la aprobación y la cocina viven en el panel.
- La **foto subida en producción** no se ha confirmado de forma expresa.

## Decisiones pendientes

- **Nombre definitivo del producto** (la dirección ya es `camarero.proyectolibero.org`: los QR impresos no se tocan).
- **Figura legal** antes de cobrar la primera cuota (`RISK-012`).
- **Cifras concretas de la cuota simbólica**, tras el primer piloto.
- **`OQ-005`**: si un plato puede prepararse en dos puestos a la vez, y dónde se cobra cada parte.
- El **token de dispositivo** del comensal y el **límite de intentos** (F2).

## Método de trabajo (aprendido a golpes)

> Escribir un trozo, **verificarlo con una prueba ejecutada**, y solo entonces el siguiente.

Las lecciones van de `LL-006` a `LL-028` y casi todas son de la misma familia: **suponer sin comprobar**. Las tres que más han cambiado el método: mirar lo que se ve (`LL-020`), no fiarse de una captura (`LL-021`), y no escribir un contrato por delante de lo construido (`LL-022`).

Y desde el 2026-10-01, **nada se acepta sin que lo audite el fiscal**.
