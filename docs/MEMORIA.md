# La memoria del Proyecto Camarero

Este proyecto tiene **memoria estructurada**, y esa memoria es el contrato de trabajo
entre el humano, el arquitecto y los agentes.

## Por que existe

En la fase de planificacion acumulamos decenas de decisiones: no habra pagos en la app,
el comensal es anonimo, usamos Cloudflare y no Vercel, el dinero es entero, el
emparejamiento de mesa necesita aprobacion humana. Sin un sitio unico donde vivan, en
tres semanas cada agente propone cosas incompatibles con lo ya decidido y el proyecto
se desvia en silencio.

Una memoria en un prompt no sirve: se pierde. Una memoria en una base de datos opaca
tampoco: no se revisa. Por eso la fuente de verdad son **ficheros markdown versionados
en git**, y el MCP es el guardian que los indexa, los valida y bloquea lo que rompe
las reglas.

## Estructura

```
docs/memory/
├── overview.md          Mapa del sistema (documento unico)
├── state.md             Fase actual, bloqueos, siguiente paso (unico)
├── roadmap.md           Fases y alcance (unico)
├── conventions.md       Reglas de codigo, testing, seguridad (unico)
├── glossary.md          Vocabulario ubicuo (unico)
├── adr/                 ADR-0001 ... Decisiones de arquitectura (inmutables)
├── decisions/           D-001 ...    Decisiones de producto y proceso (inmutables)
├── tasks/               TASK-F1-01   Trabajo con criterios de aceptacion
├── risks/               RISK-001     Riesgos con mitigacion
├── questions/           OQ-001       Preguntas abiertas al humano
├── lessons/             LL-001       Errores y su prevencion (inmutables)
├── contracts/           CONTRACT-*   Contratos e invariantes del sistema
└── log/                 Bitacora cronologica (append-only)
```

## La regla que mas se olvida

> **Todo `.md` dentro de `docs/memory/` es un documento con frontmatter valido.**

No hay excepciones: no se puede dejar un README, un borrador ni una nota suelta. El
validador los marcara como error de integridad. La documentacion para humanos vive
fuera: aqui (`docs/MEMORIA.md`) y en `tools/mcp-memory/README.md`.

## Herramientas

Se usan a traves del MCP `camarero-memory`.

### Lectura (uso libre)

| Herramienta | Para que |
|-------------|----------|
| `memory_overview` | Primera llamada de cualquier sesion: mapa, fase, tareas, riesgos |
| `memory_context` | **El briefing**: todo lo relevante sobre un tema o una tarea |
| `memory_search` | Localizar decisiones previas antes de proponer algo nuevo |
| `memory_get` | Leer un documento completo |
| `memory_next` | Siguiente tarea accionable y por que |
| `memory_validate` | Informe de integridad |
| `memory_ping` | Comprobar que apunta al sitio correcto |

### Escritura (validada)

| Herramienta | Crea |
|-------------|------|
| `adr_create` | Un ADR numerado (exige alternativas descartadas) |
| `decision_record` | Una decision de producto o proceso |
| `task_create` | Una tarea con criterios de aceptacion |
| `task_update` | Cambia estado; **aplica el gate de rigor** |
| `record_append` | Riesgo, pregunta, leccion o entrada de bitacora |
| `doc_upsert` | Documentos mutables: overview, glossary, conventions, state, roadmap, contract |

## El gate de rigor

`task_update` con `status: "done"` **no es un cambio de campo: es un examen**. Se
rechaza el cierre si:

1. La tarea no declara criterios de aceptacion.
2. Los tests no constan en verde (`tests.passed: true`).
3. Falta la evidencia (`tests.evidence`) con comando y resultado.
4. No existe el documento asociado (`doc`) apuntando a un fichero real.
5. Alguna dependencia (`depends_on`) sigue abierta.

Esto es lo que convierte "maximo rigor" en un hecho verificable en lugar de una
intencion. La evidencia se escribe asi:

```
tests_passed: true
evidence: "2026-09-27 · pnpm test · 128 pasan, 0 fallan, 0 omitidos"
```

**Los requisitos no son configurables por tarea.** Antes existia un campo `requires` que
permitia desactivarlos; la auditoria de seguridad demostro que convertia el control en
algo que el propio llamante podia apagar, y se elimino. Un `requires` que intente
desactivarlos es ahora un error de integridad.

### Lo que el gate NO hace

El gate comprueba que la evidencia **existe**, no que sea verdad. Un `tests.passed: true`
con una evidencia inventada lo supera. Verificarlo exigiria ejecutar la suite desde el
propio servidor, y eso abriria una superficie de ejecucion que no queremos en un MCP de
escritura. La consecuencia es una regla de conducta, no de codigo: **no mientas en la
evidencia**.

## La memoria es dato, no instruccion

Todo lo que el MCP devuelve va envuelto entre `<<<MEMORIA-INICIO>>>` y `<<<MEMORIA-FIN>>>`,
precedido de un aviso explicito: es contenido del proyecto, no ordenes dirigidas al
agente. Es la mitigacion mas barata que funciona contra la inyeccion de instrucciones a
traves de la memoria, y no sustituye a la revision humana: quien puede escribir en la
memoria puede intentarlo. Por eso una decision o un contrato se revisan antes de mergear,
como cualquier otro cambio de codigo.

## Invariantes tecnicas

1. **Frontera de escritura unica**: el MCP solo escribe dentro de `docs/memory/`. Se
   comprueba dos veces: la ruta lexica (`safeResolve`, que rechaza `..`, rutas absolutas,
   unidades, flujos NTFS y puntos finales) y la ruta **real** antes de escribir
   (`assertRealPathContained`, que detecta enlaces y junctions). Queda una ventana TOCTOU
   entre ambas, documentada como limitacion consciente.
2. **Append-only real**: ADR, decisiones, lecciones y bitacora nunca se reescriben. Solo
   crecen. La historia no se reescribe.
3. **Guardia de secretos bloqueante y sin fugas**: el repositorio es publico (AGPL).
   Cualquier escritura con un token, clave o cadena de conexion con credenciales **se
   rechaza**. Ademas, **todo mensaje que sale del servidor se redacta**: la auditoria
   demostro que un frontmatter roto con un token dentro filtraba el token a traves del
   mensaje de error de la libreria YAML.
4. **Contenido validado antes de escribir**: el frontmatter se comprueba contra el
   esquema y el estado contra su tipo **antes** de tocar disco. Antes no se validaba y el
   servidor podia persistir documentos invalidos que solo fallaban al releerlos.
5. **Sin indice persistente**: el indice se reconstruye en memoria. Si algo se corrompe,
   se borra y se regenera. La memoria nunca queda irrecuperable.
6. **Alcance explicito**: aqui vive el **desarrollo** (arquitectura, decisiones,
   contratos, roadmap). Los datos de producto (cartas, pedidos, mesas) viven en Postgres.

## Como se mantiene

- Cada decision nueva se registra en el momento, no "luego".
- Cada error genera una leccion con causa raiz y prevencion.
- Al cerrar una fase se actualizan `state.md` y `roadmap.md`.
- `memory_validate` debe salir sin errores antes de cerrar una tarea.

## Puesta en marcha

```bash
cd tools/mcp-memory
npm install
npm test
```

El MCP se registra en `opencode.json` del proyecto. **opencode no recarga la
configuracion en caliente**: tras anadir o cambiar un servidor MCP hay que reiniciar.

Detalles tecnicos en `tools/mcp-memory/README.md`.
