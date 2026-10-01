# @camarero/domain

Logica **pura** del dominio: sin red, sin base de datos, sin efectos secundarios. Es el
corazon del negocio y el unico sitio donde un error se paga caro.

Aqui vive, por ahora:

- el **subtotal de lineas** en enteros de pesos chilenos,
- las **transiciones de estado** de la comanda (`order-state.ts`), que son la fuente unica
  de la matriz de `CONTRACT-estados-comanda`.

Llegara con la Fase 3: el **reparto de cuenta** (4 modos: por item, equitativo, a medias y
manual), las **propinas** y los **descuentos**.

Reglas:

- Todos los importes son **enteros de pesos chilenos (CLP)**: nunca `float` ni `.toFixed()`.
- **100 % de cobertura obligatoria**: un error de redondeo es un conflicto real con un
  cliente. Casos borde siempre testeados.
- Sin dependencias de produccion: el borde lo empaqueta y no arrastra nada al runtime.

## Uso

Se importa como paquete del workspace (`@camarero/domain`) desde `workers/api`. Sus funciones
son puras y se prueban sin base de datos ni red.
