# camarero-memory

Servidor MCP que sirve la memoria estructurada del Proyecto Camarero: fuente de verdad
en markdown, indexada en memoria, validada en cada escritura.

## Que problema resuelve

Los agentes necesitan saber, antes de escribir una linea, que ya se decidio, que
contratos hay que cumplir y que tests se exigen. Y el humano necesita que "maximo rigor"
no dependa de la disciplina de un prompt. Este servidor convierte las reglas del
proyecto en codigo: las valida y las bloquea.

## Instalacion

```bash
cd tools/mcp-memory
npm install
npm test
```

No hay paso de build: Node ejecuta TypeScript directamente (type stripping, estable
desde Node 24.12). El typecheck es `npm run typecheck`.

## Registro

Ya esta registrado en `opencode.json` del proyecto. Para otro cliente MCP (Claude
Desktop, Cursor, etc.), el comando es:

```json
{
  "command": "node",
  "args": ["C:/PROYECTOS/Camarero/tools/mcp-memory/src/index.ts"],
  "env": { "CAMARERO_REPO_ROOT": "C:/PROYECTOS/Camarero" }
}
```

## Variables de entorno

| Variable | Por defecto | Para que |
|----------|-------------|----------|
| `CAMARERO_REPO_ROOT` | se deduce desde la ubicacion del paquete | Raiz del repositorio |
| `CAMARERO_MEMORY_ROOT` | `<repo>/docs/memory` | Raiz de la memoria (tests y entornos aislados) |

## Herramientas

### Lectura

- `memory_overview` — mapa del proyecto: inventario, fase, tareas, riesgos, preguntas.
- `memory_context` — briefing completo para un tema o una tarea (decisiones, ADRs,
  contratos, convenciones, glosario, lecciones y el gate aplicable).
- `memory_search` — busqueda sin acentos con filtros por tipo, estado, fase y etiqueta.
- `memory_get` — documento completo por identificador o ruta.
- `memory_next` — siguiente tarea accionable y las bloqueadas con su motivo.
- `memory_validate` — informe de integridad.
- `memory_ping` — comprobacion de salud.

### Escritura

- `adr_create`, `decision_record` — inmutables y numerados; exigen alternativas.
- `task_create`, `task_update` — el cierre en `done` pasa por el gate de rigor.
- `record_append` — riesgo, pregunta, leccion o bitacora.
- `doc_upsert` — solo tipos mutables (singletons y contratos).

## Arquitectura

```
src/
├── index.ts              arranque stdio. stdout es SOLO protocolo; los logs van a stderr
├── server.ts             unico acoplamiento con el SDK de MCP
├── schema.ts             contrato de tipos, estados y nomenclatura de identificadores
├── core/
│   ├── paths.ts          resolucion segura: nadie sale de docs/memory
│   ├── frontmatter.ts    parseo y serializacion con orden de campos estable
│   ├── guards.ts         guardian de secretos y datos personales (bloqueante)
│   ├── store.ts          carga, indice en memoria, busqueda y numeracion
│   ├── writer.ts         escritura atomica
│   └── validate.ts       integridad de la memoria y gate de rigor
└── tools/
    ├── result.ts         formato de respuesta
    ├── read.ts           herramientas de lectura
    └── write.ts          herramientas de escritura
```

## Decisiones de diseno

- **Markdown versionado, no base de datos.** La memoria se revisa en un pull request, se
  diffea y sobrevive a este servidor. El indice es derivado y reconstruible.
- **Frontera de escritura unica, en dos capas.** `safeResolve` valida la ruta lexica
  (rechaza `..`, absolutas, unidades, flujos NTFS `fichero.md:ads` y puntos finales) y
  `assertRealPathContained` valida la ruta real antes de escribir, lo que detecta enlaces
  y junctions. Queda una ventana TOCTOU entre las dos, aceptada conscientemente.
- **Append-only para la historia.** ADR, decisiones y lecciones no se reescriben.
- **Guardia de secretos bloqueante, y salida redactada.** El repositorio es publico; un
  secreto filtrado es permanente. Ademas, **todo mensaje que sale del servidor pasa por
  `redactForOutput`**: un error de libreria puede arrastrar la linea de origen que lo
  provoco, y esa linea puede contener un token.
- **Contenido validado antes de escribir.** El frontmatter se comprueba contra el esquema
  y el estado contra su tipo antes de tocar disco, para no persistir documentos invalidos.
- **La memoria es dato, no instruccion.** Todo lo que se devuelve va delimitado por
  `<<<MEMORIA-INICIO>>>` / `<<<MEMORIA-FIN>>>` con un aviso explicito. Es la mitigacion
  mas barata contra la inyeccion de instrucciones a traves del contenido de la memoria.
- **El gate no es configurable.** Los requisitos son fijos: exponerlos como parametro
  convertia el control en algo que el llamante podia apagar.
- **SDK v1 aislado en `server.ts`.** Migrar al SDK v2 (paquetes partidos, Zod v4) es
  cambiar un fichero. Ver ADR-0004.

## Tests

```bash
npm test          # suite completa
npm run typecheck # TypeScript estricto, sin emision
npm run check     # ambos
```

Los tests siempre trabajan sobre un arbol temporal: nunca tocan `docs/memory` real.
`tests/setup.ts` apunta `CAMARERO_MEMORY_ROOT` a una ruta inexistente a proposito, para
que un test que olvide pasar su propio `root` falle en lugar de escribir datos reales.

## Limitaciones conocidas

- **Sin indice persistente**: cada operacion relee la memoria. Con decenas de documentos
  es irrelevante; por encima de unos miles habria que anadir un FTS. El texto normalizado
  por documento si se precalcula en `load`.
- **Sin bloqueo entre procesos**: dos sesiones que escriban a la vez en el mismo fichero
  pueden pisarse. La escritura es atomica, pero no hay bloqueo optimista todavia.
- **Ventana TOCTOU** entre la comprobacion de ruta y la escritura. Cerrarla exigiria
  abrir el fichero por descriptor; no compensa en un MCP local de un solo usuario.
- **El gate comprueba presencia, no veracidad.** Un `tests.passed: true` con evidencia
  inventada lo supera. Verificarlo exigiria ejecutar la suite desde el servidor.
- **La guardia de secretos es heuristica**: detecta patrones conocidos (incluidos
  separadores `=`, `:`, `->` y `=>`) pero no descifra base64 ni reconstruye un secreto
  partido en varias lineas. Reduce el riesgo, no lo elimina, y nunca sustituye a la
  revision humana.
- **La delimitacion como dato no impide la inyeccion**: marca el contenido como no
  confiable, pero un lector descuidado puede ignorar el aviso. Es una mitigacion de
  superficie, no una garantia.

## Licencia

AGPL-3.0-or-later, igual que el resto del proyecto.
