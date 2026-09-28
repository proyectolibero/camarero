---
id: CONTRACT-modelo-datos
type: contract
title: Modelo de datos del producto
status: active
date: 2026-09-28
tags:
  - datos
  - postgres
  - contrato
related:
  - D-007
  - D-022
  - D-035
  - ADR-0006
  - ADR-0010
  - ADR-0012
  - TASK-F0-02
---

## Definición

Las **28 tablas** del producto, implementadas y verificadas en `packages/db/migrations/`
(0002 a 0011). Los nombres van en `snake_case`.

Un `org` agrupa los locales de un mismo dueño; un `location` es una sede. Toda tabla lleva
`org_id` directa o indirectamente.

## Aislamiento: lo que garantiza el esquema

**Las 28 tablas tienen RLS activada y `FORCE ROW LEVEL SECURITY`.** El `FORCE` no es
decorativo: sin él, el propietario de una tabla ignora sus políticas y las funciones de
contexto se convierten en una vía de fuga (`LL-004`, `RISK-017`). Hay un test que lo
comprueba.

**27 de las 28 tienen al menos una política. `ratelimit_counters` tiene cero, a propósito**
— ver la sección de plataforma. Es la única excepción y está declarada como tal en el test
de metadatos, no escondida.

La regla que gobierna las políticas es **cero ciclos** (`ADR-0013`): la política de una
tabla no puede leer esa misma tabla, ni directa ni transitivamente. Las lecturas de otras
tablas por funciones `SECURITY DEFINER` son válidas si no hay camino de vuelta, y son el
mecanismo con el que el comensal anónimo resuelve su contexto. Un test que recorre el grafo
de dependencias lo comprueba en cada ejecución del pipeline (`ADR-0012`).

## Identidad y locales

| Tabla | Campos clave |
|-------|--------------|
| `orgs` | `id`, `name`, `legal_name`, `plan`, `created_at` |
| `locations` | `id`, `org_id`, `slug`, `name`, `timezone`, `currency` (CLP), `theme_json`, `logo_r2_key`, `cover_r2_key`, `status`, `service_mode` |
| `opening_hours` | `location_id`, `weekday`, `opens_at`, `closes_at`, `closed` |
| `zones` | `id`, `location_id`, `name`, `kind` (`sala`/`barra`/`terraza`/`delivery`) |
| `tables` | `id`, `location_id`, `zone_id`, `label`, `code`, `capacity`, `kind`, `active` |
| `table_links` | `group_id`, `table_id`, `role` (`primary`/`secondary`) — merge de mesas |

`tables.code` es único por local y de exactamente 8 caracteres en base32 **sin `0`, `O`, `1`
ni `I`**: se dicta por teléfono y esos cuatro se confunden al oído. Hay una restricción que
lo hace cumplir.

## Personal y roles

| Tabla | Campos clave |
|-------|--------------|
| `staff` | `id`, `org_id`, `location_id`, `email`, `role`, `display_name`, `pin_hash`, `active` |
| `staff_devices` | `id`, `staff_id`, `device_token`, `pin_fail_count`, `locked_until` |
| `audit_log` | `id`, `org_id`, `actor_staff_id`, `action`, `entity`, `entity_id`, `before_json`, `after_json`, `created_at` |

Roles: `platform_admin`, `org_owner`, `location_manager`, `server`, `kitchen`, `no_pin`.
`no_pin` entra sin PIN a una tablet compartida: ve comandas, no toca precios ni cobros.

`audit_log` es **append-only de verdad**: existen políticas de `select` e `insert`, y
**ninguna de `update` ni de `delete`**. No se puede ampliar en tiempo de ejecución: solo una
migración podría añadir una política de mutación. El personal nunca se borra, se desactiva
con `active`; aun así la auditoría sobrevive a un borrado (`on delete set null`).

`staff.location_id` **nulo significa alcance de organización** para `org_owner` y
`location_manager`. Para `server`, `kitchen` y `no_pin` significa **no ver nada**: un
camarero sin local asignado está mal configurado, y ante una configuración rota lo correcto
es fallar cerrado.

## Carta

| Tabla | Campos clave |
|-------|--------------|
| `menu_categories` | `id`, `location_id`, `name_i18n`, `sort_order`, `active`, `available` |
| `menu_items` | `id`, `location_id`, `category_id`, `name_i18n`, `description_i18n`, `price_clp`, `photo_r2_key`, `allergens`, `tags`, `prep_station`, `available`, `available_from`, `available_until`, `sort_order`, `active` |
| `modifier_groups` | `id`, `location_id`, `name_i18n`, `min_select`, `max_select`, `required` |
| `modifier_options` | `id`, `group_id`, `name_i18n`, `price_delta_clp` |
| `item_modifier_groups` | `item_id`, `group_id` (N:M) |

**Todo importe es `integer` de pesos chilenos** (`ADR-0006`). Nunca `float` ni `numeric` con
decimales. Hay restricciones `>= 0` en todos los importes.

Los modificadores **solo suman** (`D-036`): un delta negativo es una promoción encubierta y
para eso existe `promotions`.

## Mesas, sesiones y comandas

| Tabla | Campos clave |
|-------|--------------|
| `table_sessions` | `id`, `org_id`, `location_id`, `table_id`, `code`, `state`, `mode`, `opened_at`, `closed_at`, `party_size`, `pairing_expires_at` |
| `table_devices` | `id`, `session_id`, `device_alias`, `joined_at`, `last_seen` — **anónimo** |
| `pairing_requests` | `id`, `session_id`, `table_id`, `state`, `decided_by`, `decided_at`, `reason` |
| `orders` | `id`, `org_id`, `location_id`, `session_id`, `source`, `placed_by_staff_id`, `status`, `client_alias`, `subtotal_clp`, `discount_clp`, `total_clp`, `note`, `idempotency_key`, `delivery_meta_json`, `created_at` |
| `order_items` | `id`, `order_id`, `menu_item_id`, `name_snapshot`, `unit_price_clp`, `qty`, `note`, `line_total_clp` |
| `order_item_modifiers` | `id`, `order_item_id`, `option_id`, `name_snapshot`, `price_delta_clp` |

`table_sessions.org_id` está **desnormalizado desde el local** a propósito: rompe la
recursión de políticas entre `table_sessions` y `locations`. Un disparador `BEFORE` lo
completa desde el local y **falla en voz alta** si el local no existe, en lugar de dejar la
fila sin organización.

`name_snapshot` y `unit_price_clp` son **copias inmutables** del momento del pedido: si el
local cambia el precio o renombra un plato, las comandas de ayer siguen siendo verdaderas.

Estados de la comanda en **español** (`D-035`): `pendiente`, `aceptada`, `preparando`,
`lista`, `servida`, `cerrada`, `anulada`. Ver `CONTRACT-estados-comanda`.

`orders.idempotency_key` es única **globalmente**, no por local: es un token opaco de alta
entropía generado en cada envío, así que un reintento de red se deduplica aunque lo atienda
otro borde.

## Promociones y cuenta

| Tabla | Campos clave |
|-------|--------------|
| `promotions` | `id`, `location_id`, `kind`, `code`, `value`, `min_subtotal_clp`, `max_discount_clp`, `valid_from`, `valid_to`, `max_uses`, `used_count`, `active` |
| `bill_requests` | `id`, `session_id`, `split_mode`, `tip_percent`, `splits_json`, `state`, `requested_at` |
| `checkouts` | `id`, `bill_request_id`, `session_id`, `settled_by_staff_id`, `payment_method`, `total_clp`, `tip_clp`, `settled_at` |

`checkouts` **no guarda número de tarjeta, ni autorización, ni referencia de pago**: solo el
hecho de que un empleado del local registró un cobro. El dinero nunca pasa por el sistema.
Es un contrato de producto, no una limitación técnica, y está escrito en el comentario de la
tabla para que nadie lo «mejore» en el futuro.

Un cobro se imputa **a quien lo registra**: la política de inserción exige
`settled_by_staff_id = staff_actual()`. Nadie firma por otro.

La propina vive aquí y no en `orders`: una comanda no sabe si la mesa va a dividir la cuenta
ni cuánto va a dejar. Se decide al pedirla.

## Plataforma

| Tabla | Campos clave |
|-------|--------------|
| `push_subscriptions` | `id`, `staff_id`, `endpoint`, `p256dh`, `auth`, `created_at`, `last_ok_at` |
| `kitchen_stations` | `id`, `location_id`, `name`, `kind` |
| `daily_metrics` | `location_id`, `date`, `orders`, `covers`, `clp_gross`, `avg_ticket_clp` — agregados **sin PII** |
| `ratelimit_counters` | `bucket`, `window_start`, `count` |
| `idempotency_keys` | `key`, `org_id`, `response_json`, `created_at` |

**`ratelimit_counters` tiene RLS y `FORCE` pero cero políticas, y es deliberado.** Es una
tabla de plataforma sin `org_id`: solo debe tocarla el rol de servicio. Con RLS activada y
sin ninguna política permisiva, el defecto es denegar y ningún actor de la aplicación ve
nada. Está declarada en la lista explícita de excepciones del test de metadatos, que exige
que tenga exactamente 0 políticas.

`daily_metrics` **no guarda ningún dato personal**, solo agregados. `idempotency_keys` es
global pero lleva `org_id`: una organización no puede leer la respuesta cacheada de otra.
