---
id: conventions
type: conventions
title: "Convenciones de codigo, dinero, seguridad, testing y git"
status: active
date: 2026-09-27
tags: [convenciones, codigo, dinero, seguridad, testing, git]
related: []
---

## Codigo

- Una funcion, una responsabilidad. Maximo **30 lineas** por funcion.
- Maximo **3 niveles** de anidamiento. Si hay mas, refactorizar con retornos tempranos.
- Nombres descriptivos: `calcularRepartoDeCuenta()`, no `calc()`.
- Sin variables ni imports sin usar. Sin codigo comentado sin explicacion.
- Sin `any` ni `as` innecesarios. TypeScript estricto o no sirve de nada.
- Comentarios en espanol que expliquen **por que**, no que.
- Errores: nunca silenciar con `catch {}` vacio. Distinguir error esperado de bug.

## Dinero

- Los importes son **enteros de pesos chilenos (CLP)**. Nunca `float`, nunca `.toFixed()`
  para calcular.
- Una unica funcion de calculo de totales en `packages/domain`. Ver `CONTRACT-dinero`.
- El reparto de cuenta tiene **100 % de cobertura obligatoria**: un error de redondeo es
  un conflicto con un cliente real.
- Casos borde siempre testeados: division con resto, modificadores, descuento que no da
  entero, propina sobre total ya descontado y division entre uno.

## Seguridad

- Cero secretos en el repositorio. Variables de entorno y secretos del proveedor.
- RLS activado y **probado** en toda tabla. Un test por tabla que falle si falta politica.
- Validacion en el servidor, nunca solo en el cliente (Zod en cada borde).
- El precio **nunca** viene del cliente: se calcula en la base de datos desde la carta.
- Nunca `innerHTML` con datos de la base de datos.
- Cabeceras: CSP, HSTS, `nosniff` y `Referrer-Policy`.
- Antes de guardar cualquier cosa en la memoria, el MCP escanea secretos y datos
  personales. No se debe intentar sortearlo.

## Testing

- Un cambio de logica de negocio **exige** test. Sin test, no hay cambio.
- Cubrir siempre: caso feliz, caso borde y caso de error.
- Tests de comportamiento, no de implementacion.
- Nombres: `describe('Modulo') > it('debe ... cuando ...')`.
- La suite debe correr en menos de 60 segundos. Una suite lenta no se ejecuta.

## Git

- Conventional Commits: `tipo(scope): descripcion corta`, maximo 72 caracteres.
- Tipos: `feat`, `fix`, `test`, `refactor`, `docs`, `security`, `chore`.
- Una rama por tarea: `feature/nombre`, `fix/nombre`, `security/nombre`.
- Nunca commitear `node_modules`, `.env`, credenciales ni artefactos de build.
- Antes de cerrar una tarea: tests en verde, sin secretos y lint aplicado.
