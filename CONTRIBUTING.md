# Como contribuir

Antes de escribir una linea, lee `AGENTS.md`, `docs/MEMORIA.md` y
`docs/memory/conventions.md`. La memoria del proyecto manda: si algo la contradice, para y
pregunta.

## Flujo

1. Trabaja en una rama propia a partir de `main`.
2. Un cambio, una responsabilidad: commits y PRs pequenos y revisables.
3. Antes de pedir revision: `pnpm check` en verde.
4. Registra en la memoria la decision o la leccion que corresponda.

## Ramas

Una rama por tarea, con prefijo segun el tipo de trabajo:

- `feature/nombre` para funcionalidad nueva,
- `fix/nombre` para correccion de errores,
- `security/nombre` para cambios de seguridad.

## Commits

Conventional Commits, **maximo 72 caracteres en la primera linea**:

```
tipo(scope): descripcion corta
```

Tipos permitidos: `feat`, `fix`, `test`, `refactor`, `docs`, `security`, `chore`.

## Regla de cierre

**Ninguna tarea se cierra sin tests en verde y sin registrar la decision o la leccion en la
memoria.** El cierre de una tarea es una verificacion, no un cambio de campo:

- los criterios de aceptacion estan cumplidos,
- los tests pasan y la evidencia queda registrada,
- la decision o la leccion se ha anadido a la memoria.

Si un cambio no lleva test, no es un cambio: es una promesa.

## Prohibido

- Secretos, credenciales o tokens de cualquier tipo en el repositorio.
- `console.log`, `print` o `debugger` de desarrollo.
- Codigo comentado sin explicacion.
- Anadir una dependencia de produccion sin justificarla en un ADR.
