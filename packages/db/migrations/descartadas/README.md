# Migraciones descartadas

Aquí viven los intentos de migración que **no funcionan** y que no deben aplicarse. El
runner solo lee `packages/db/migrations/*.sql` del primer nivel, así que un fichero con
extensión `.descartada` es inerte: existe para no perder lo aprendido, no para ejecutarse.

## Por qué están aquí

Cierran la regla central del producto —*el precio nunca viene del cliente*— y **no
convergen**. Tres intentos, tres recursiones distintas de políticas RLS, y ninguna
verificación en verde. Ver `RISK-016` en la memoria del proyecto.

| Fichero | Intento | Por qué falló |
|---------|---------|---------------|
| `0011_*.descartada` | 1 | Funciones `SECURITY DEFINER` que hacían `UPDATE` sobre `orders` y `order_items`. Con `FORCE ROW LEVEL SECURITY` el definer queda sujeto a las políticas del llamante: el `UPDATE` afectaba a **0 filas en silencio** y el recálculo se descartaba. Ver `LL-007`. |
| `0012_*.descartada` | 1 | `en_mi_local` provocaba recursión infinita al leer `locations` desde la política de `locations`. Ver `LL-008`. |
| `0011_*.intento-3.descartada` | 3 | Disparador `BEFORE` sobre la propia fila (diseño correcto, ver `ADR-0008`), pero **rompe la suite**: en el sembrado no hay contexto `app.*`, el definer no puede leer `menu_items` bajo `FORCE RLS` y el disparador lanza. Y su versión final perdió el disparador que protegía los totales de la comanda. |
| `0012_*.intento-3.descartada` | 3 | Cierra la recursión del encargado pero **abre otra peor** (`locations → en_mi_local_comensal → table_sessions → en_mi_local → locations`), que deja **inservible todo el camino del comensal**. |

## Qué NO hacer con estos ficheros

- **No renombrarlos a `.sql`** para "probarlos": rompen la suite (99 en verde + 24 omitidos
  en lugar de 123 en verde).
- **No copiarlos a ciegas** al rediseño. El patrón que falla está identificado: **resolver
  el alcance con funciones que leen tablas**. Con `FORCE RLS` en 28 tablas, cualquier
  camino entre dos de ellas cierra el círculo.

## Lo que sí hay que rescatar de aquí

No todo es descartable. Estas piezas están bien pensadas y deberían sobrevivir al rediseño:

- **El principio de `ADR-0008`**: los importes se derivan en un disparador `BEFORE` sobre la
  propia fila, nunca con `UPDATE` desde funciones. El problema del intento 3 no fue el
  principio, sino el alcance del definer al leer la carta durante el sembrado.
- **Rechazar en lugar de corregir en silencio**: si el precio recibido no coincide con el de
  la carta, la operación se rechaza. Un intento de manipular un importe tiene que doler y
  tiene que dejar rastro.
- **`deltas` y `least(descuento, bruto)`** de `0011`: el descuento nunca puede superar el
  bruto de las líneas.
- **Las tres correcciones funcionales de `0012`**: el cobro se imputa a quien lo registra,
  el encargado sin local alcanza su organización, y un comensal no puede insertar líneas sin
  `menu_item_id`.

## La decisión que falta

Ver `RISK-016`. Hay que elegir entre desnormalizar `org_id`/`location_id` para que ninguna
política necesite una subconsulta, o resolver el contexto completo del actor al abrir la
sesión. **Nada de esto se aplica hasta que la decisión esté tomada y verificada.**