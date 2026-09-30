---
id: TASK-F1-04
type: task
title: El mapa visual de mesas, colocado con botones grandes y sin JavaScript en el panel
status: done
date: 2026-09-30
phase: F1
tags:
  - panel
  - mapa
  - mesas
  - movil
  - fase-1
related:
  - ADR-0023
  - ADR-0029
  - CONTRACT-pantallas
  - CONTRACT-modelo-datos
  - TASK-F1-03
acceptance:
  - El mapa de cada zona se dibuja en el servidor como SVG, con cada mesa en su celda y su etiqueta
  - Cada mesa se mueve con botones grandes (arriba, abajo, izquierda, derecha) y el movimiento queda guardado
  - Una mesa nueva aparece sola en el primer hueco libre, sin que nadie la coloque a mano
  - Una mesa desactivada se ve distinta de una activa, de un vistazo
  - "El panel sigue sin una sola linea de JavaScript, y hay una prueba que lo comprueba: el HTML del mapa no contiene ninguna etiqueta script"
  - El mapa es legible y usable en un movil
  - Mover una mesa a una celda ocupada se resuelve de forma predecible y se explica en pantalla, nunca moviendo dos mesas a la vez sin avisar
  - No se puede sacar una mesa de la cuadricula
  - "Pruebas: mover en las cuatro direcciones, limite de la cuadricula, mesa nueva, celda ocupada, sin sesion y sin permiso"
  - "En vivo: el dueno mueve una mesa y la ve cambiar de sitio"
depends_on:
  - TASK-F1-03
doc: contracts/contract-pantallas-contract-pantallas-superficies-permisos-y-convenciones-del-armaz.md
tests:
  suite: pnpm test
  passed: true
  evidence: "2026-09-30 · pnpm test · workers/api 170 + packages/db 72 + tools/mcp-memory 95 = 337 pasan, 0 fallan. typecheck 0; biome ci 0. Migracion 0017 aplicada en el Supabase real (17 entradas en el historial, 29 tablas, 98 politicas, aislamiento 0 filas sin contexto). Revision VISUAL hecha por el arquitecto sobre capturas generadas desde el codigo real: el contraste del estado desactivado estaba en 2,84:1 (por debajo de la norma 4,5:1) y quedo en 6,06:1; la altura del movil bajo de 4.827 a 3.030 px al sustituir las flechas por mesa por un unico mando sobre la mesa elegida; y la previsualizacion dejo de mentir (codigos generados con el generador real y cada zona con sus mesas). El panel sigue sin una sola etiqueta script, con prueba que lo comprueba y que se demostro capaz de fallar."
---

## Descripcion

Rebanada del mapa visual de mesas (ADR-0029). El dueno ve cada zona dibujada y coloca sus mesas segun la realidad de su local, moviendolas con botones grandes. Se dibuja en el servidor como SVG: el panel NO gana JavaScript, que es justo lo que el humano pidio al elegir botones en lugar de arrastre. Hace falta una migracion para guardar la posicion de cada mesa (fila y columna), porque el modelo no la tiene todavia.

## Aceptacion

- [ ] El mapa de cada zona se dibuja en el servidor como SVG, con cada mesa en su celda y su etiqueta
- [ ] Cada mesa se mueve con botones grandes (arriba, abajo, izquierda, derecha) y el movimiento queda guardado
- [ ] Una mesa nueva aparece sola en el primer hueco libre, sin que nadie la coloque a mano
- [ ] Una mesa desactivada se ve distinta de una activa, de un vistazo
- [ ] El panel sigue sin una sola linea de JavaScript, y hay una prueba que lo comprueba: el HTML del mapa no contiene ninguna etiqueta script
- [ ] El mapa es legible y usable en un movil
- [ ] Mover una mesa a una celda ocupada se resuelve de forma predecible y se explica en pantalla, nunca moviendo dos mesas a la vez sin avisar
- [ ] No se puede sacar una mesa de la cuadricula
- [ ] Pruebas: mover en las cuatro direcciones, limite de la cuadricula, mesa nueva, celda ocupada, sin sesion y sin permiso
- [ ] En vivo: el dueno mueve una mesa y la ve cambiar de sitio

## Notas

- **2026-09-30** — Build completa y desplegada. No se marca done: falta que el dueno mueva una mesa en /admin/mesas desde el movil. La celda ocupada se rechaza con 409 (D-046); la cuadricula crece hacia abajo y a la derecha y bloquea los indices negativos. Verificacion en vivo de /admin/mesas sin sesion: 200 con la entrada, SIN cabecera Location (la pantalla se muestra, no redirige); el CSS /panel/estilos.css ya sirve .mapa-svg, .mover-boton, .mapa-mesa-inactiva, lo que confirma el despliegue. Nota: Cloudflare inyecta en el borde su propio script de deteccion al final del HTML; el CSP (default-src 'none', sin script-src) lo bloquea, pero el HTML que llega al navegador si contiene esa etiqueta, ajena al panel.

- **2026-09-30** — Revisión visual pendiente del humano. Detectados tres defectos vistos en capturas: (1) jerga 'f1 c3', (2) lista larguísima en móvil por 4 botones por mesa, (3) previsualización con códigos falsos y datos cruzados por zona.

- **2026-09-30** — Cerrada con la prueba en vivo del dueno (movio una mesa y la vio cambiar de sitio). Decisiones: D-046 (mover a una celda ocupada se rechaza con un mensaje claro, porque un boton mueve una mesa y no dos) y D-047 (la posicion no se muestra en jerga; para eso esta el mapa). Cuatro defectos los encontro la revision VISUAL y ninguna prueba podia verlos (LL-020): el contraste del estado desactivado, la jerga f1 c3, la lista larguisima en movil, y una previsualizacion que ensenaba codigos falsos y mesas de otras zonas. La prevencion quedo en el codigo: el guion que genera la previsualizacion llama a las funciones de renderizado reales y la carpeta esta ignorada por git; ademas la prueba de contraste exige los minimos y se comprobo que sabe fallar.
