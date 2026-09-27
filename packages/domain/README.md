# @camarero/domain

Logica **pura** del dominio: sin red, sin base de datos, sin efectos secundarios. Es el
corazon del negocio y el unico sitio donde un error se paga caro.

Aqui vivira:

- el **calculo de totales** y el **reparto de cuenta** (4 modos: por item, equitativo, a
  medias y manual),
- las **propinas** y los **descuentos** (con piso entero, nunca `float` ni `.toFixed()`),
- las **transiciones de estado** de la comanda.

Reglas:

- Todos los importes son **enteros de pesos chilenos (CLP)**.
- **100 % de cobertura obligatoria**: un error de redondeo es un conflicto real con un
  cliente. Casos borde siempre testeados (division con resto, modificadores, descuento que
  no da entero, propina sobre total ya descontado, division entre uno).

## Por que todavia no hay codigo

El paquete se crea ya para fijar su identidad, su configuracion de TypeScript estricta y la
frontera de responsabilidad. El codigo llega con la tarea de la Fase 3 (cuenta), con sus
tests. Hasta entonces no hay `src/`: una carpeta vacia no documenta nada y un
`package.json` sin contenido es ruido.

Cuando llegue el primer modulo, se anaden los scripts `typecheck` y `test` para que
`pnpm -r run typecheck` y `pnpm -r run test` lo cubran desde la raiz.
