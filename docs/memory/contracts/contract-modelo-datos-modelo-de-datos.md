---
id: CONTRACT-modelo-datos
type: contract
title: "Modelo de datos del producto"
status: active
date: 2026-09-27
tags: [datos, postgres, contrato]
related: [D-007, D-022]
---

## Definicion

Resumen de las tablas del producto. Los nombres van en `snake_case`. `org` agrupa locales de
un mismo dueno. **Todas las tablas llevan `org_id` directa o indirectamente y RLS activada y
probada, con `current_setting('app.org_id')`.** Ninguna tabla queda sin politica.

## Identidad y locales

| Tabla | Campos clave |
|-------|--------------|
| `orgs` | `id`, `name`, `legal_name`, `plan`, `created_at` |
| `locations` | `id`, `org_id`, `slug`, `name`, `timezone`, `currency` (CLP), `theme_json`, `logo_r2_key`, `cover_r2_key`, `status`, `service_mode` |
| `opening_hours` | `location_id`, `weekday`, `opens_at`, `closes_at`, `closed` |
| `zones` | `id`, `location_id`, `name`, `kind` (sala/barra/terraza/delivery) |
| `tables` | `id`, `location_id`, `zone_id`, `label`, `code` (8 chars base32, unico), `capacity`, `kind`, `active` |
| `table_links` | `group_id`, `table_id`, `role` (primary/secondary) — merge de mesas |

## Personal y roles

| Tabla | Campos clave |
|-------|--------------|
| `staff` | `id`, `org_id`, `location_id`, `email`, `role`, `display_name`, `pin_hash`, `active` |
| `staff_devices` | `id`, `staff_id`, `device_token`, `pin_fail_count`, `locked_until` |
| `audit_log` | `id`, `org_id`, `actor_staff_id`, `action`, `entity`, `entity_id`, `before_json`, `after_json`, `created_at` |

Roles: `platform_admin`, `org_owner`, `location_manager`, `server`, `kitchen` y `no_pin`.
El rol `no_pin` entra sin PIN a una tablet compartida: ve comandas, no toca precios ni cobros.

## Carta

| Tabla | Campos clave |
|-------|--------------|
| `menu_categories` | `id`, `location_id`, `name_i18n`, `sort_order`, `active`, `available` |
| `menu_items` | `id`, `location_id`, `category_id`, `name_i18n`, `description_i18n`, `price_clp` (integer), `photo_r2_key`, `allergens`, `tags`, `prep_station`, `available`, `available_from`, `available_until`, `sort_order`, `active` |
| `modifier_groups` | `id`, `location_id`, `name_i18n`, `min_select`, `max_select`, `required` |
| `modifier_options` | `id`, `group_id`, `name_i18n`, `price_delta_clp` |
| `item_modifier_groups` | `item_id`, `group_id` (N:M) |

## Mesas, sesiones y pedidos

| Tabla | Campos clave |
|-------|--------------|
| `table_sessions` | `id`, `location_id`, `table_id`, `code`, `state`, `mode`, `opened_at`, `closed_at`, `party_size`, `pairing_expires_at` |
| `table_devices` | `id`, `session_id`, `device_alias` (hash), `joined_at`, `last_seen` — anonimo |
| `pairing_requests` | `id`, `session_id`, `table_id`, `state`, `decided_by`, `decided_at`, `reason` |
| `orders` | `id`, `org_id`, `location_id`, `session_id`, `source`, `placed_by_staff_id`, `status`, `client_alias`, `subtotal_clp`, `discount_clp`, `total_clp`, `note`, `idempotency_key` (unico), `delivery_meta_json`, `created_at` |
| `order_items` | `id`, `order_id`, `menu_item_id`, `name_snapshot`, `unit_price_clp`, `qty`, `note`, `line_total_clp` |
| `order_item_modifiers` | `id`, `order_item_id`, `option_id`, `name_snapshot`, `price_delta_clp` |

`name_snapshot` y `unit_price_clp` son copias inmutables: si el local cambia el precio o
renombra un plato, las comandas de ayer siguen siendo verdaderas.

## Promociones y cuenta

| Tabla | Campos clave |
|-------|--------------|
| `promotions` | `id`, `location_id`, `kind`, `code`, `value`, `min_subtotal_clp`, `max_discount_clp`, `valid_from`, `valid_to`, `max_uses`, `used_count`, `active` |
| `bill_requests` | `id`, `session_id`, `split_mode`, `tip_percent`, `splits_json`, `state`, `requested_at` |
| `checkouts` | `id`, `bill_request_id`, `session_id`, `settled_by_staff_id`, `payment_method`, `total_clp`, `tip_clp`, `settled_at` |

`checkouts` no guarda numero de tarjeta, ni autorizacion, ni nada del TPV: solo el hecho de
que un empleado del local registro un cobro. El dinero nunca pasa por el sistema.

## Plataforma

| Tabla | Campos clave |
|-------|--------------|
| `push_subscriptions` | `id`, `staff_id`, `endpoint`, `p256dh`, `auth`, `created_at`, `last_ok_at` |
| `kitchen_stations` | `id`, `location_id`, `name`, `kind` |
| `daily_metrics` | `location_id`, `date`, `orders`, `covers`, `clp_gross`, `avg_ticket_clp` — agregados sin PII |
| `ratelimit_counters` | `bucket`, `window_start`, `count` |
| `idempotency_keys` | `key`, `org_id`, `response_json`, `created_at` |
