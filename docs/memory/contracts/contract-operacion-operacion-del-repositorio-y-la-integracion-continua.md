---
id: CONTRACT-operacion
type: contract
title: Operación del repositorio y la integración continua
status: draft
date: 2026-09-27
tags:
  - infraestructura
  - proceso
related:
  - ADR-0002
  - ADR-0005
  - TASK-F0-01
  - TASK-F0-03
---

## Qué gobierna este contrato

Cómo se levanta el proyecto en una máquina limpia, qué tiene que pasar para que un cambio
se integre, y qué decisiones de infraestructura no se renegocian en cada tarea.

## Puesta en marcha desde cero

```bash
git clone https://github.com/proyectolibero/camarero
cd camarero
pnpm install
pnpm check
```

`pnpm check` encadena lint, comprobación de tipos y tests. Es la misma cadena que ejecuta
la integración continua, así que **si pasa en local, pasa en el pipeline**.

### Requisitos

- **Node >= 22.18**, y se recomienda 24 (`.nvmrc`). El proyecto usa el *type stripping*
  nativo de TypeScript: no hay paso de build. Ver ADR-0005.
- **pnpm**. Si `corepack enable` no funciona por permisos, `npm install -g pnpm` es una
  alternativa válida.

### Comandos

| Comando | Qué hace |
|---------|----------|
| `pnpm check` | Lint + tipos + tests. Es la puerta de entrada |
| `pnpm lint` | Biome |
| `pnpm format` | Biome con escritura |
| `pnpm typecheck` | `tsc --noEmit` en todos los paquetes |
| `pnpm test` | Vitest en todos los paquetes |

## El pipeline

| Workflow | Cuándo | Qué hace |
|----------|--------|----------|
| `.github/workflows/ci.yml` | push y pull request | Biome, `tsc --strict` y Vitest |
| `.github/workflows/security.yml` | push, pull request y semanal | osv-scanner sobre el lockfile |

### Por qué hay tres jobs de osv-scanner y no uno

- En un **pull request** se usa la variante que compara la rama base con la propuesta: lo
  que importa es qué dependencias introduce ESE cambio.
- En un **push** a `main` no hay comparación posible: se escanea el árbol tal como quedó.
- El **semanal** escanea aunque nadie toque el repositorio, porque una vulnerabilidad
  publicada hoy afecta a código que ayer estaba limpio.

Usar la variante de PR para un push produce un run sin sentido. Está separado a propósito.

### Las acciones externas se fijan por SHA

Una etiqueta es un puntero móvil. Un workflow que corre con permiso de escritura sobre los
eventos de seguridad no puede depender de que nadie mueva esa etiqueta. Por eso
`google/osv-scanner-action` está fijada al commit de `v2.6.0`.

## Reglas que no se negocian

1. **La protección de rama exige el check `Lint, tipos y tests`** con `strict: true`. Sin
   CI en verde no hay merge.
2. **Ningún script de `package.json` puede invocar una herramienta que no esté instalada.**
   Un script que promete algo que no puede cumplir es peor que no tenerlo.
3. **Los scripts de paquete no se invocan con `--if-present`** en la raíz: un paquete que
   debería tener tests y no los tiene no puede pasar desapercibido.
4. **El hook de pre-commit corre Biome sobre lo que va en el commit y `tsc` sobre todo el
   monorepo.** Los tests completos se dejan al pipeline: un hook lento se acaba saltando
   con `--no-verify`, y entonces no protege de nada.
5. **Cero secretos en el repositorio.** El repositorio es público.
6. **Este repositorio no despliega nada todavía.** La integración continua es la única
   puerta; el despliegue es la `TASK-F0-03`.

## Integración de agentes

Todo paquete nuevo debe declarar los scripts `typecheck` y `test`. Un paquete sin ellos
rompe la promesa de `pnpm check`, que es la base sobre la que se apoya el gate de rigor de
la memoria.

## Deuda conocida

- **La protección de rama no exige el check de Seguridad**, solo el de CI. Es deliberado
  mientras el escáner tenga hallazgos abiertos; se endurecerá cuando la deuda de
  dependencias esté saldada.
- **Los diagnósticos informativos de Biome sobre claves literales se anotan, no se
  arreglan solos**: su corrección automática está marcada como *unsafe*.
