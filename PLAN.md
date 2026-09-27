# Proyecto Camarero — Plan de Ecosistema

> Garzón/camarero virtual para locales de hostelería. Software libre (AGPL), con coste de
> operación, pagado con una cuota simbólica por local, muy por debajo del mercado.
> Documento vivo. Última actualización: fase de planificación inicial.

---

## 0. Resumen ejecutivo

Un comensal escanea un QR (o NFC) en su mesa, se abre una **PWA** sin instalar nada, se
empareja con la mesa **con aprobación humana de un empleado**, ve la carta, pide directo a
cocina, sigue sus pedidos, llama al empleado, pide la cuenta con el reparto que quiera
(por ítems, equitativo, a medias) y un empleado la cobra en el TPV del local.

**No somos sistema de pagos.** No procesamos dinero, no emitimos comprobantes, no
almacenamos datos personales del comensal. Somos una capa de información y coordinación
entre la mesa y el local. Toda la responsabilidad comercial, fiscal y sanitaria es del local.

Estado: **planificación cerrada → Fase 0 (cimientos)**.

---

## 1. Decisiones confirmadas (contrato de producto)

| # | Decisión | Motivo |
|---|----------|--------|
| D1 | País piloto: **Chile** | Base de locales y_clusters existente |
| D2 | Cliente: **PWA** (QR/NFC → URL) | Sin fricción de instalación, un solo código |
| D3 | Hosting: **cloud gestionado, 100 % free tiers** | Presupuesto 0 |
| D4 | **Sin integración de TPV en el MVP** | El local cobra en su caja |
| D5 | **No hay pagos dentro de la app** | Elimina pasarela, PCI, KYC, regulación CMF |
| D6 | El local **emite su propio comprobante** | Sin responsabilidad fiscal nuestra |
| D7 | Comensal **anónimo con alias de mesa** | Minimiza datos personales (Ley 21.719) |
| D8 | **Emparejamiento de mesa aprobado por un empleado** | Evita mesas fantasma ydomains que se auto-asignan |
| D9 | La comanda **va directa a la cocina** | Menos fricción para el comensal |
| D10 | Estados: `pendiente → aceptada → preparando → lista → servida → cerrada` + `anulada` | Confirmado |
| D11 | Modificadores, notas y cantidades por plato | Confirmado |
| D12 | Cupones, promociones y descuentos configurables por local | Mínima fricción, se adapta al local |
| D13 | Disponibilidad en tiempo real + horarios + días de cierre | Confirmado |
| D14 | Personalización por local: logo, colores, portada, banner | Confirmado |
| D15 | **Sin historial ni perfiles de comensal** | Cada visita empieza de cero |
| D16 | Traducciones (es/en) **responsabilidad del local** | Nosotros no validamos ni traducimos |
| D17 | Plan de mesas propio: añadir, quitar, **unir (merge)**, zonas/barra/terraza | Diseño libre por local |
| D18 | Notificación al empleado: **realtime + sonido + Web Push de respaldo** | Lo más rápido y con menos fricción |
| D19 | Coexisten **pedido desde mesa** y **toma de comanda desde móvil del camarero** | Ambos sistemas |
| D20 | Estados de cliente: avisos con sonido/vibración | Confirmado |
| D21 | Stack: **TypeScript de punta a punta** | Un solo lenguaje |
| D22 | Datos: sin preocupación de residencia, **solo datos del establecimiento** | El comensal no deja datos |
| D23 | **Un solo dominio global** | `app.dominio/t/<codigo>` |
| D24 | Tags NFC **opcionales y pagados por el local** | Fuera de nuestro presupuesto |
| D25 | Código **público, licencia AGPL** | Preserve el código y permite autohospedaje |
| D26 | Responsabilidad **siempre del local**; nosotros somos intermediario | Texto legal de exención |
| D27 | Retención: **mínima, la que exija la ley** | Purga de identificadores técnicos |
| D28 | Tests: **70 % lógica de negocio, 100 % reparto de cuenta** | Aceptado |
| D29 | Disponibilidad objetivo **99 %** con degradación elegante | Aceptado |
| D30 | Backup **semanal** | Ver §7.3: Supabase Free no incluye backups |
| D31 | Monitorización gratuita (Sentry, UptimeRobot/Better Stack) | Aceptado |
| D32 | **Una persona a tiempo completo** (el autor) | Permite ~18 semanas hasta v1 |
| D33 | Negocio: **cuota simbólica por sede**, pilotos gratis, nada de fricción con el mercado | Ético y sostenible |
| D34 | License AGPL + **sin lock-in**: exportación abierta de datos | Arma anti-captura |

### 1.1 Correcciones al brief original (tres cambios de rumbo)

1. **"Pagar desde el móvil" → "pedir la cuenta".** El pago ocurre en el TPV del local.
   *Impacto:* −30 % de alcance, −100 % de responsabilidad financiera. Se elimina Mercado Pago
   de la ecuación. Queda como feature opt-in futura (el local conecta su pasarela).
2. **"Empleado virtual" → "intermediario tecnológico".** Dices "somos un mero empleado
   suyo"; legalmente esa redacción crea una apariencia de relación laboral que no existe.
   El texto correcto es *plataforma de gestión de pedidos* / *intermediario*. Lo anoto porque
   aparecerá en los términos de servicio.
3. **"Fidelización" vs "anonimato" son incompatibles.** Fidelizar exige identificar al
   comensal (D15 lo prohíbe). **Decisión pendiente:** en v1 hay descuentos, promociones y
   cupones, pero **no** programa de fidelización. Se resuelve en v2 con un código de
   fidelización impreso por el local (sin identidad en nuestra base).

---

## 2. Correcciones de infraestructura (investigación de free tiers)

Estos dos hallazgos invalidan el stack inicial que te propuse y son la razón de este apartado.

### 2.1 Vercel Hobby NO admite uso comercial

Los términos de Vercel restringen el plan Hobby a **"uso personal y no lucrativo"**. Un
proyecto que cobra una cuota a locales es uso comercial → **términos violados, riesgo de
suspensión de la cuenta**. Límites Hobby actuales: 100 GB de transferencia, 1 M de
invocaciones, 4 h CPU, timeout de funciones.

**Decisión: Cloudflare en lugar de Vercel.**

| Necesidad | Elección gratuita y comercialmente válida |
|-----------|----------------------------------------------|
| Frontend / PWA | **Cloudflare Pages** (gratis, sin restricción de uso) |
| API / Web Push / cron | **Cloudflare Workers** (100 k req/día gratis) |
| Imágenes de carta | **Cloudflare R2** (10 GB gratis) — *no* Supabase Storage (1 GB) |
| Dominio | Cloudflare DNS (ya tienes `proyectolibero.org`) |

El autor ya tiene cuenta en Cloudflare. Ventaja adicional: mismo proveedor para DNS,
frontend, API e imágenes.

### 2.2 Supabase Free: sin backups y con pausa por inactividad

Límites Free verificados (2026): 500 MB de BD (read-only al superarlo), 5 GB de egress,
1 GB de storage, 50 k MAU, **200 conexiones realtime concurrentes**, 2 M de mensajes
realtime/mes, 500 k invocaciones de Edge Functions, 2 proyectos, 1 miembro por organización.

Dos trampas:

1. **No hay backups automáticos en Free.** (Pro: sí, 7 días). → **Mitigación en §7.3.**
2. **El proyecto se pausa tras 7 días de inactividad.** → **Mitigación: un cron gratuito
   diario que además hace el backup y actúa de keep-alive.**

Ambos límites son Holgado para 1-3 locales piloto. El día que entre dinero, Pro a USD 25/mes
es el salto natural y está presupuestado.

### 2.3 Veredicto de viabilidad

| Recurso | Límite | Consumo esperado (3 locales) | Holgura |
|---------|--------|-------------------------------|---------|
| Conexiones realtime | 200 | ~30 | 6× |
| MAU | 50 000 | ~3 000 | 16× |
| Egress Supabase | 5 GB/mes | < 1 GB | 5× |
| R2 imágenes | 10 GB | ~2 GB | 5× |
| Workers | 100 k/día | ~5 k | 20× |

**Coste mensual real hoy: 0 USD.** Primer coste inevitable: el dominio (~10 USD/año).

---

## 3. Arquitectura

### 3.1 Diagrama

```
┌──────────────────┐         ┌──────────────────┐
│  Comensal (PWA)  │         │  Empleado (PWA)   │      ┌─────────────────────┐
│  escanea QR/NFC  │         │  KDS + comanda    │      │  Dueño (Web panel)  │
└────────┬─────────┘         └────────┬──────────┘      └──────────┬──────────┘
         │                            │                            │
         │      HTTPS / WSS           │                            │
         └────────────┬───────────────┴────────────────────────────┘
                      ▼
         ┌────────────────────────────────────────┐
         │        Cloudflare Pages (PWA + web)    │
         │        Cloudflare Workers (API edge)   │
         │   - web push  - cron  - rate limit     │
         └───────┬──────────────────────┬─────────┘
                 │                      │
        ┌────────▼────────┐    ┌────────▼─────────────┐
        │  Supabase       │    │ Cloudflare R2        │
        │  - Postgres+RLS │    │ fotos de carta       │
        │  - Auth (staff) │    └──────────────────────┘
        │  - Realtime     │
        │  - Storage(mín) │
        └─────────────────┘
```

### 3.2 Principios de diseño

1. **La base de datos es la primera clase.** Toda la lógica de negocio vive en funciones
   Postgres (`SECURITY DEFINER`) con permisos por rol. Menos superficie en la API, menos
  Surface de ataque, más difícil de saltarse reglas.
2. **RLS en todas las tablas, sin excepción y testeada.** Un test por tabla que falle si no
   hay política.
3. **El comensal nunca es una fila identificable.** Es un `session_token` opaco + un hash de
   dispositivo pararate-limit. Sin email, sin teléfono, sin IP persistente más de N días.
4. **La `service_role` key jamás llega al cliente.** Solo vive como secreto en Workers.
5. **El local es la autoridad.** Cualquier dato que el local cargue (alérgenos, precios,
   traducciones) se muestra tal cual con la exención de responsabilidad visible.
6. **Offline-first en lectura, con outbox en escritura.** La carta se cachea; si cae la red,
   la comanda se encola y se reintenta con idempotencia.

### 3.3 Monorepo

```
camarero/
├─ apps/
│  ├─ web/            # PWA comensal (React + Vite)  -> /t/:code
│  ├─ staff/          # PWA empleado: KDS + comanda   -> /staff
│  └─ admin/          # Web panel del dueño           -> /admin
├─ packages/
│  ├─ ui/             # design system (tokens, componentes, a11y)
│  ├─ db/             # migraciones SQL, RLS, funciones, seeds
│  ├─ domain/         # lógica pura: reparto de cuenta, totales, propinas, estados
│  ├─ i18n/           # es / en (solo UI; contenido del local aparte)
│  └─ shared/         # tipos, zod schemas, constantes
├─ workers/
│  ├─ api/            # Cloudflare Worker (web push, cron, rate limit)
│  └─ backup/         # script pg_dump + cifrado -> R2
├─ docs/
│  ├─ ADRs/           # Architecture Decision Records
│  ├─ seguridad.md
│  └─ modelo-datos.md
└─ ops/               # terraform-free, scripts de infra, runbooks
```

Gestor de paquetes: **pnpm workspaces**. Tooling: **Biome** (lint+format), **tsc --strict**,
**Zod**, **Vitest** (unit), **Playwright** (e2e), **Drizzle** para migraciones tipadas
(suplemento de SQL plano, que es la fuente de verdad para RLS).

---

## 4. Modelo de datos (resumen)

Nombres en `snake_case`. `org` agrupa locales de un mismo dueño. Todas las tablas llevan
`org_id` directa o indirectamente, y RLS con `current_setting('app.org_id')`.

### 4.1 Identidad y locals

| Tabla | Campos clave | Notas |
|-------|--------------|-------|
| `orgs` | `id`, `name`, `legal_name`, `plan`, `created_at` | La cuenta del dueño |
| `locations` | `id`, `org_id`, `slug`, `name`, `timezone`, `currency` (`CLP`), `theme_json`, `logo_r2_key`, `cover_r2_key`, `status` (`draft/active/paused`), `service_mode` (`dine_in/delivery/both`) | Un local = una sede |
| `opening_hours` | `location_id`, `weekday`, `opens_at`, `closes_at`, `closed` | Horarios y días de cierre |
| `zones` | `id`, `location_id`, `name`, `kind` (`sala/barra/terraza/delivery`) | |
| `tables` | `id`, `location_id`, `zone_id`, `label`, `code` (8 chars base32, único), `capacity`, `kind` (`mesa/barra`), `active` | El `code` va en el QR/NFC |
| `table_links` | `group_id`, `table_id`, `role` (`primary/secondary`) | **Merge**: varias mesas = una mesa |

### 4.2 Personal y roles

| Tabla | Campos clave |
|-------|--------------|
| `staff` | `id`, `org_id`, `location_id` (null = todos), `email`, `role` (`platform_admin/org_owner/location_manager/server/kitchen/no_pin`), `display_name`, `pin_hash`, `active` |
| `staff_devices` | `id`, `staff_id`, `device_token`, `pin_fail_count`, `locked_until` |
| `audit_log` | `id`, `org_id`, `actor_staff_id`, `action`, `entity`, `entity_id`, `before_json`, `after_json`, `created_at` |

Roles y permisos (matriz viva en `docs/ADRs/0002-permisos.md`):

| Acción | platform_admin | org_owner | location_manager | server | kitchen | no_pin |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|
| Editar carta / precios | ✔ | ✔ | ✔ | | | |
| Crear/eliminar mesas y zonas | ✔ | ✔ | ✔ | | | |
| Gestionar personal | ✔ | ✔ | ✔ | | | |
| Aprobar emparejamiento de mesa | | ✔ | ✔ | ✔ | | ✔ |
| Aprobar / anular comanda | | | ✔ | ✔ | | ✔ |
| Marcar estados de cocina | | | ✔ | | ✔ | |
| Pedir / cerrar cuenta | | | ✔ | ✔ | | ✔ |
| Ver métricas del local | ✔ | ✔ | ✔ | | | |
| Ver todas las orgs | ✔ | | | | | |

`no_pin` es un rol de turno: entra sin PIN a una tablet compartida, ve comandas, no toca
precios ni cobros.

### 4.3 Carta

| Tabla | Campos clave |
|-------|--------------|
| `menu_categories` | `id`, `location_id`, `name_i18n` (jsonb es/en), `sort_order`, `active`, `available` |
| `menu_items` | `id`, `location_id`, `category_id`, `name_i18n`, `description_i18n`, `price_clp` (integer, sin decimales), `photo_r2_key`, `allergens` (array), `tags` (`vegetariano/vegano/sin_gluten/picante`), `prep_station` (`frio/caliente/bar/postre/bebidas`), `available` (bool), `available_from`/`available_until` (ventanas horarias), `sort_order`, `active` |
| `modifier_groups` | `id`, `location_id`, `name_i18n`, `min_select`, `max_select`, `required` |
| `modifier_options` | `id`, `group_id`, `name_i18n`, `price_delta_clp` |
| `item_modifier_groups` | `item_id`, `group_id` (N:M) |

**Dinero:** `price_clp` es `integer`. Nunca float. Toda aritmética en enteros. Test
obligatorio de redondeo en el reparto de cuenta (§6.4).

### 4.4 Mesas, sesiones y pedidos

| Tabla | Campos clave |
|-------|--------------|
| `table_sessions` | `id`, `location_id`, `table_id`, `code` (alias legible), `state` (`pairing/requested/active/closed/voided`), `mode` (`dine_in/delivery`), `opened_at`, `closed_at`, `party_size`, `pairing_expires_at` |
| `table_devices` | `id`, `session_id`, `device_alias` (hash), `joined_at`, `last_seen` — **anónimo** |
| `pairing_requests` | `id`, `session_id`, `table_id`, `state` (`pending/approved/rejected/expired`), `decided_by`, `decided_at`, `reason` |
| `orders` | `id`, `org_id`, `location_id`, `session_id`, `source` (`table/staff/delivery`), `placed_by_staff_id` (null si es mesa), `status` (`pending/accepted/preparing/ready/served/closed/voided`), `client_alias`, `subtotal_clp`, `discount_clp`, `total_clp`, `note`, `idempotency_key` (unique), `delivery_meta_json`, `created_at` |
| `order_items` | `id`, `order_id`, `menu_item_id`, `name_snapshot` (copia literal), `unit_price_clp`, `qty`, `note`, `line_total_clp` |
| `order_item_modifiers` | `id`, `order_item_id`, `option_id`, `name_snapshot`, `price_delta_clp` |

`name_snapshot` y `unit_price_clp` son copias inmutables: si el local sube el precio o renombra
un plato mañana, las comandas de ayer siguen siendo verdaderas. Esto es también una decisión
de responsabilidad (el local responde por lo que pidió, por lo que vio).

### 4.5 Promociones y cuenta

| Tabla | Campos clave |
|-------|--------------|
| `promotions` | `id`, `location_id`, `kind` (`percent/fixed/free_item`), `code` (nullable), `value`, `min_subtotal_clp`, `max_discount_clp`, `valid_from`, `valid_to`, `max_uses`, `used_count`, `active` |
| `bill_requests` | `id`, `session_id`, `split_mode` (`by_item/equal/half/manual`), `tip_percent`, `splits_json`, `state` (`requested/preparing/ready/settled/voided`), `requested_at` |
| `checkouts` | `id`, `bill_request_id`, `session_id`, `settled_by_staff_id`, `payment_method` (`tpv_card/tpv_cash/tpv_other`), `total_clp`, `tip_clp`, `settled_at` |

`checkouts` **no** guarda número de tarjeta, ni autorización, ni nada del TPV. Solo el hecho
de que un empleado registró un cobro. El dinero nunca pasa por nosotros.

### 4.6 Plataforma

| Tabla | Campos clave |
|-------|--------------|
| `push_subscriptions` | `id`, `staff_id`, `endpoint`, `p256dh`, `auth`, `created_at`, `last_ok_at` |
| `kitchen_stations` | `id`, `location_id`, `name`, `kind` — para filtrar el KDS |
| `daily_metrics` | `location_id`, `date`, `orders`, `covers`, `clp_gross`, `avg_ticket_clp` — agregados, sin PII |
| `ratelimit_counters` | `bucket`, `window_start`, `count` — rate limiting en DB |
| `idempotency_keys` | `key`, `org_id`, `response_json`, `created_at` |

---

## 5. Flujos críticos

### 5.1 Emparejamiento de mesa (D8)

```
Comensal                  Sistema                  Empleado
   │ escanea QR ────────────►│                       │
   │ /t/ABC123XYZ           │                       │
   │◄─── pantalla "Solicitando aprobación" ────────►│
   │                         ├── pairing_request ────►│  push + sonido
   │                         │   (pending, expira 90s)│  "Mesa 4 pide acceso"
   │                         │                       │
   │                         │◄── aprobar / rechazar │
   │◄── aprobado: alias mesa │                       │
   │◄── rechazado: explica   │                       │
   │                         │                       │
   │         varios móviles se unen a la MISMA sesión│
```

Reglas:
- El `code` de 8 caracteres base32 es **imposible de adivinar** (≈ 40 bits), pero la
  aprobación humana es la barrier real: un escaneo no autorizado no abre nada.
- Expiración a los 90 s con pantalla de reintento claro ("Tu mesero no ha respondido").
- Rate limit: 5 intentos de emparejamiento por dispositivo y hora.
- La sesión se cierra sola tras 4 h de inactividad o cuando el jefe de sala la cierra.

### 5.2 Comanda directa a cocina (D9) + anti-abuso

El comensal **no ve confirmación humana antes de enviar** (requisito), pero sí hay un
mecanismo de cinco capas que el usuario percibe como "claridad", no como fricción:

| # | Mecanismo | Qué hace |
|---|-----------|----------|
| 1 | **Resumen antes de enviar** | "3 platos · $12.500 · se enviará a cocina ahora". Sin coste, un toque. |
| 2 | **Tope de líneas por envío** | Configurable por local (def. 10). Imposible pedir 40 platos de golpe. |
| 3 | **Ventana de calma** | 25 s desde el último envío a la misma mesa; muestra cuenta atrás. |
| 4 | **Anti-doble-tap e idempotencia** | Botón deshabilitado + `idempotency_key` única. Un reintento de red nunca duplica. |
| 5 | **Aviso inequívoco en la carta** | "Enviar a cocina es definitivo. Si te equivocaste, pulsa «Llamar a mi mesero»." |

Y una sexta capa, del lado del local, que es la que de verdad resuelve el problema:

| # | Mecanismo | Qué hace |
|---|-----------|----------|
| 6 | **KDS instantáneo + rechazo** | La comanda aparece al instante. Si es un error, cocina o jefe la **anula** y el comensal recibe aviso. La comanda entra como `pending`, no como `aceptada`: la verdad. |

**Anti-flood en el KDS:** si una misma mesa genera ≥ 3 envíos en 2 minutos, el KDS los
**colapsa** visualmente en un bloque con contador y avisa "muchos pedidos seguidos de Mesa 4".
El exceso se ve de un vistazo en lugar de 7 filas separadas.

### 5.3 Estados de la comanda (D10)

```
                 ┌──────────► anulada (local)
                 │
  [envío] → pendiente → aceptada → preparando → lista → servida → cerrada
                 │           │           │         │         │
            (cocina/jefe acepta)  (cocina)  (cocina) (servido) (jefe, tras cobro)
```

Transiciones permitidas (matriz en `domain/order-state.ts`, test 100 %):

| De | A permitted |
|----|-------------|
| `pendiente` | `aceptada`, `anulada` |
| `aceptada` | `preparando`, `anulada` |
| `preparando` | `lista`, `anulada` |
| `lista` | `servida`, `anulada` |
| `servida` | `cerrada`, `anulada` |
| `cerrada` | — (terminal) |
| `anulada` | — (terminal) |

Reglas: no se retrocede. Todo cambio va a `audit_log`. El comensal ve el estado en vivo.

### 5.4 Cuenta dividida (D11) — el núcleo de negocio

`packages/domain` — TypeScript puro, sin I/O, **100 % de cobertura obligatoria**, porque es
donde un error de redondeo se traduce en una pelea con un cliente.

**Modos:**

| Modo | Algoritmo |
|------|-----------|
| `by_item` | Cada comensal marca líneas. Una línea puede dividirse entre N (con pesos o a medias). |
| `equal` | `total / n` con distribución exacta de céntimos: se reparte el resto de 1 peso entre los primeros `total % n`, en orden estable. Nunca `.toFixed()`. |
| `half` | Reparto en 2 (o en mitades exactas cuando el total es par). Con resto explícito a una parte. |
| `manual` | El jefe de sala fija montos. Validado contra el total; no puede exceder ni quedar corto. |

**Cálculo del total (fórmula única, sin atajos):**

```
bruto        = Σ (unit_price_clp × qty + Σ price_delta_clp)     // enteros
descuento    = aplicar_promocion(bruto, promoción)             // redondeo a entero, piso
propina      = redondear_piso( subtotal × tip_percent / 100 )   // 10 % de 12.500 = 1.250
total        = subtotal + propina                              // subtotal = bruto − descuento
```

**Propina sugerida (D):** selector 0 / 5 / 10 / 15 / 20 % con un valor por defecto
configurable por local. Se registra como "propina sugerida a incluir en la cuenta" y se
entrega al jefe de sala para que la aplique en el TPV. **El 100 % va al local**: el sistema no
reparte ni registra propina por empleado (queda fuera de alcance; ver §11).

**Casos borde que deben estar testeados** (los que de verdad rompen sistemas reales):
- Total 12.500 dividido entre 3 → 4.166 / 4.167 / 4.167 (suma exacta 12.500).
- Modificadores con delta: un plato a 8.900 + "extra queso" +900 = 9.800.
- Descuento por porcentaje que no da entero: 10 % de 9.990 = 999 exacto; 10 % de 9.995 = 999,5 → piso 999.
- Descuento mayor que el bruto → limitado a `max_discount_clp` o al subtotal.
- Línea a medio asignada a 2 personas y el total es impar.
- Cuenta con 1 solo comensal (no dividir por 0).
- Propina sobre total ya descontado, no sobre el bruto.

### 5.5 Toma de comanda desde el móvil del camarero (D19)

Mismo modelo de datos, distinto `source`:
- El camarero elige la mesa (o la crea) desde la lista de mesas de su local.
- Puede añadir notas internas visibles solo en el KDS (`internal_note`, nunca visible para el comensal).
- Requiere rol `server`, `location_manager`, `org_owner` o `platform_admin`. `no_pin` puede leer pero no enviar (evita que un empleado sin credencial formal genere comanda).

### 5.6 Cola de pedidos para retiro/delivery

No es un producto distinto: es un **filtro del mismo sistema** (`location.service_mode`).
- `service_mode = delivery` → la PWA del comensal no pide emparejamiento de mesa; elige
  "retiro" o "delivery" y un alias, y el local ve una **cola ordenada**:
  `pendiente → aceptada → preparando → lista → entregada`.
- El nombre y la dirección del cliente **no se guardan** (D15/D27). El local gestiona la
  entrega por su propio canal (teléfono, chat). El sistema entrega el número de pedido para
  que se crucen por fuera. Esto es una limitación deliberada y debe estar escrita en la UI.
- Reutiliza `orders` con `mode = delivery` y `delivery_meta_json` para el tipo de entrega.

### 5.7 Offline y degradación elegante (D29)

| Situación | Comportamiento |
|-----------|----------------|
| Sin red, carta ya cargada | Navegación completa de la carta desde Service Worker + caché. |
| Sin red, al enviar comanda | Se encola en `outbox` (IndexedDB) con su `idempotency_key`, se avisa "sin conexión, se enviará al recuperar". |
| Al recuperar la red | Reintento con backoff. Si la mesa expiró, se avisa y se descarta con aviso claro. |
| API caída, PWA viva | Menú cacheado. Botón "Enviar" muestra "EstamosVISION con problemas, tu pedido está guardado. Llama a tu mesero". |
| Supabase pausado | El plan previene la pausa (keep-alive, §7.3). Si ocurre, un endpoint de salud lo explica al comensal sin filtrar detalles. |
| KDS sin red | Último estado cacheado en pantalla + indicador "sin conexión" + acción manual posible. |

Regla de oro: **el comensal nunca ve una pantalla de error técnica.** Todo fallo se traduce a
una acción humana posible ("pide a tu mesero", "espera un momento", "vuelve a intentar").

### 5.8 Notificaciones (D18)

Prioridad porMilliseconds, de más a menos fricción:

1. **Supabase Realtime** (ya conectado a la sesión): inmediata, 0 coste, sin permisos.
2. **Audio en la PWA del empleado**: `WebAudio` beep distinto por tipo de evento (emparejamiento / comanda nueva / plato listo). Sonido de 2 s, volumen razonable, interruptible.
3. **Vibración** en el dispositivo.
4. **Web Push** (VAPID vía Cloudflare Worker): *solo* si la PWA está cerrada o en segundo plano. Es la red de seguridad, no la vía principal.
5. **Escalado**: si una solicitud de emparejamiento no se atiende en 45 s, se notifica a otro empleado del local.

Worker de push: `workers/api` con `web-push`, claves VAPID en secretos, endpoints
suscripciados en `push_subscriptions`. Límite: 1 push por evento crítico, coalescendo el resto.

---

## 6. Seguridad

Marco de referencia: **OWASP ASVS L1 + Top 10 2021**, y la Ley 21.719 de protección de datos
personales (Chile), que sustituye a la 19.628. Todo el proceso con herramientas gratuitas.

### 6.1 Modelo de amenazas (resumen)

| # | Amenaza | Mitigación |
|---|---------|-----------|
| T1 | Escaneo masivo de QR para abrir mesas ajenas | Código 40 bits **+ aprobación humana obligatoria** (D8) + rate limit |
| T2 | Cliente pide 200 platos para DoS al local | Tope de líneas, ventana de calma, anti-flood en KDS (§5.2) |
| T3 | Modificación de precios desde el cliente | Precio **nunca** viene del cliente: se calcula en Postgres desde `menu_items` |
| T4 | Acceso a carta de otro local | RLS por `org_id`/`location_id`; los tokens de mesa solo dan acceso a su sesión |
| T5 | Escalada de privilegios (empleado → dueño) | RLS por rol; el cliente nunca habla con la BD directamente para escribir |
| T6 | Acceso al panel del dueño | Supabase Auth email+password, MFA opcional, sesión corta, PIN de dispositivo separado |
| T7 | XSS vía nota de comanda o nombre de plato | React con escape por defecto + sanitización en el punto de render de texto plano de la BD (el KDS pinta texto) + CSP estricta |
| T8 | CSRF en el panel | Mismo origen, cookies `SameSite=Lax`, tokens `Authorization` en cabecera, no en cookie |
| T9 | Inyección SQL | Solo funciones `SECURITY DEFINER` parametrizadas; sin concatenación de strings |
| T10 | Abuso de la API desde fuera | Rate limit en Worker por IP y por dispositivo; límites por endpoint |
| T11 | Fuga de datos en logs | Sentry con `beforeSend` que elimina cuerpos; nunca se loguea `device_alias` ni IP |
| T12 | Dependencias vulnerables | Dependabot + `osv-scanner` bloqueando el pipeline |
| T13 | Secuestro del proyecto (repo público) | AGPL + commits firmados + 2FA en la cuenta |
| T14 | Divulgación de info de otro local | IDs no secuenciales (UUIDv7), y el código de mesa no filtra datos del local más allá de su carta pública |
| T15 | Abuso del cupón de descuento | `max_uses`, `used_count` atómico, validación server-side |

### 6.2 Matriz de controles (todo gratuito)

**Prevención**
- CSP estricta (`default-src 'self'`, sin `unsafe-inline` salvo nonce), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva.
- Validación Zod en **todo** borde (Worker y funciones Postgres).
- CORS con allowlist explícita; nunca `*` con credenciales.
- Secretos solo en Cloudflare (`wrangler secret`) y Supabase dashboard. `.env.example` en el repo, `.env` en `.gitignore`. Cero secretos en el código: regla innegociable.
- Dependabot semanal + `osv-scanner` en CI: **el pipeline falla** ante vulnerabilidad alta.

**Detección**
- GitHub Actions: `snyk test` / `osv-scanner`, ZAP baseline scan semanal contra el staging.
- Sentry free (5 k errores/mes) con `beforeSend` que filtra PII.
- UptimeRobot o Better Stack: chequeo cada 5 min sobre `/health`, alerta a correo + Telegram (gratis).
- `audit_log` de toda acción de empleado. Inmutable. La acción anulada no se borra: se marca.

**Respuesta**
- Runbook de incidente en `docs/ADRs/` + plantilla. Un solo mantenedor → el runbook es el
  mecanismo de continuidad.
- Rotación documentada de claves. Restauración probada (ver §7.3).

### 6.3 Privacidad y datos (D15, D22, D27)

**Qué guardamos del comensal: nada identificable.**

| Dato | Guardamos | Retención |
|------|-----------|-----------|
| Sesión de mesa | `code` opaco + hash de dispositivo | Se destruye al cerrar la mesa |
| IP | Solo en contadores de rate limit, hasheada con salt rotatorio | 24 h |
| User agent | No | — |
| Email / teléfono / nombre | **Nunca** | — |
| Pedidos | Snapshot literal + alias | 90 días, luego agregados |

**Lo que sí guardamos:** datos del establecimiento (nombre, razón social, RUT, contacto,
personal con su email). Eso es dato de empresa, no de consumidor: la Ley 21.719 aplica pero con
base de ejecución de contrato, no de consentimiento.

**Requisito:** una pantalla de "Sin datos personales" visible en el primer arranque, y una
política de privacidad de 1 página que diga exactamente esto. Que sea cierto, medible y
auditable es parte de la propuesta de valor ética.

**Alérgenos:** la carta muestra lo que el local ha cargado, con un aviso permanente:
*"La información de alérgenos es responsabilidad exclusiva del establecimiento. Ante una
alergia grave o un estado crítico, comunícalo siempre al personal."* El sistema no valida,
no traduce ni completa esa información.

### 6.4 Página legal (texto abierto, D26)

Cuatro páginas, redactadas por nosotros, con hueco marcado para revisión jurídica:
1. **Términos de servicio** — el local es la parte contratante; nosotros somos intermediario
   tecnológico; sin garantía de disponibilidad absoluta; orden de llegada de los pedidos.
2. **Política de privacidad** — qué datos, por qué, cuánto tiempo, cómo pedir supresión.
3. **Exención de responsabilidad** — precios, aléríos, tiempos de cocina, riesgos, calidad.
4. **Aceptación de cookies** — solo cookies técnicas de sesión; sin tracking publicitario.

Regla de oro del texto: **nunca** decir "somos empleados del local" (crea una relación
laboral inexistente). Decir **"plataforma tecnológica intermediaria"**.

---

## 7. Calidad y operación

### 7.1 Estrategia de tests (D28)

| Capa | Herramienta | Cobertura | Qué cubre |
|------|-------------|-----------|-----------|
| Dominio puro | Vitest | **100 %** en `packages/domain` | Reparto de cuenta, totales, propinas, descuentos, transiciones de estado |
| Base de datos | pgTAP / Vitest + Supabase local | RLS: **una prueba por tabla** | Que cada rol ve lo que debe y nada más |
| API / Worker | Vitest | 80 % | Validación, rate limit, web push |
| Componentes | Testing Library | 70 % | Flujos críticos de UI |
| E2E | Playwright | 5 flujos | ①emparejar→pedir→cuenta ②comanda del camarero ③KDS ④reparto ⑤delivery |

Los 5 flujos E2E son **obligatorios** antes de cualquier piloto: son el producto.

`pnpm test` debe correr en < 60 s. Nada de suites de 20 minutos: 1 persona, mucho tiempo
parcial, la suite tiene que ser rápida o no se ejecuta.

### 7.2 CI/CD (GitHub Actions, gratis en repo público)

```
push / PR  →  biome check → tsc --strict → vitest → playwright (chromium)
             → osv-scanner → migrate dry-run → deploy preview
main        →  build → tests → migrate → deploy Pages → deploy Worker
cron diario →  keep-alive DB  →  pg_dump → cifrado → R2
cron semanal → pg_dump completo → cifrado → R2 (retención 4 copias)
```

Protección de rama obligatoria. Commits firmados. Sin merge sin CI verde.

### 7.3 Backups y keep-alive (D30) — resuelve la trampa de Supabase Free

**El plan Free no incluye backups automáticos.** Solución con coste 0:

1. **Keep-alive diario** (evita la pausa a los 7 días): un `pg` query trivial vía la API,
   disparado por cron de GitHub Actions. Un query al día es suficiente.
2. **Backup semanal completo**: `pg_dump --format=custom` en el runner → cifrado con
   `age` (clave pública en el repo, privada en un gestor de secretos) → subida a
   **Cloudflare R2** (10 GB gratis).
3. **Retención**: 4 copias semanales + 1 copia mensual, 6 meses. Coste 0.
4. **Restore probado**: un runbook documentado y **un ensayo real antes de los pilotos**
   (`docs/runbooks/restore.md`). Un backup nunca probado no es un backup.
5. Cuando haya ingresos: Supabase Pro (USD 25) y backups diarios automáticos. Es el primer
   gasto que se aprueba con la primera cuota.

### 7.4 Monitorización (D31)

| Señal | Herramienta | Umbral de alerta |
|-------|-------------|------------------|
| Disponibilidad | UptimeRobot / Better Stack, 5 min | 2 checks fallidos |
| Errores app | Sentry free | > 20 errores/hora |
| Latencia API | Sentry + logs de Cloudflare | p95 > 2 s |
| Con Supabase | Dashboard: conexiones realtime, tamaño BD, uso | > 70 % de cualquier cuota |
| Pipeline | GitHub Actions | Cualquier fallo en `main` |
| Coste | Alertas de gasto de Cloudflare | > USD 0 |

### 7.5 Disponibilidad y degradación (D29)

Objetivo 99 %, que con una sola persona y free tiers significa: **sin alta disponibilidad, con
recuperación rápida y degradación elegante**. No prometemos 99,9 % porque no se puede sostener
con un mantenedor.

- Sin redundancia. Un solo origen, un solo proveedor de datos, un solo mantenedor.
- Lo que sí garantizamos: **el comensal siempre puede pedir ayuda a un humano.** Degradación
  diseñada (§5.7) y siempre un camino físico (el mesero está ahí).
- `status` público simple: un endpoint `/health` y una página de estado.

### 7.6 Accesibilidad

**WCAG 2.2 nivel AA como requisito, no como extra.** Es un local de hostelería: hay ruido, hay
gente con una mano ocupada, hay Lumbre baja, hay mayores. Botones grandes, contraste AA,
etiquetas en `<label>`, foco visible, navegación por teclado completa en el KDS, textos que
funcionen sin leer (icono + texto), y respectar `prefers-reduced-motion` y
`prefers-contrast`. Verificado con axe en CI.

---

## 8. Roadmap

Escala: 1 desarrollador a tiempo completo. Semanas de 30 h efectiva (conISRupciones reales).

### Fase 0 — Cimientos (sem 1-2) ✅ siguiente

- Monorepo pnpm + Biome + tsconfig estricto + ADR-0001 (stack).
- Supabase: 2 proyectos (dev y prod-free), esquema inicial, RLS, migraciones Drizzle.
- Cloudflare: Pages, Worker, R2, dominio `app.proyectolibero.org` (o el nombre definitivo).
- CI: biome, tsc, vitest, osv-scanner. Primer test de humo de RLS.
- GitHub: repo público, AGPL, plantillas de issue/PR, política de seguridad.
- `/health`, Sentry, UptimeRobot, primer alerta.

**Entregable:** repo público con CI verde, un local de prueba creado desde el panel, y una
mesa con QR que abre una PWA vacía.

### Fase 1 — Vertical mínimo (sem 3-5)

- Emparejamiento de mesa con aprobación (§5.1). 100 % testeado.
- Carta básica: categorías, platos, precio, foto, alérgenos, bilingüe, disponibilidad.
- PWA del comensal instalable, offline en lectura, outbox en escritura.
- KDS mínimo: lista de comandas, estados, sonido.
- Panel del dueño mínimo: crear local, carta, mesas, personal.

**Punto de decisión:** con esto ya se puede hacer un piloto real. Si el alcance posterior
se rompe, al menos existe un producto utilizable.

### Fase 2 — Comanda completa (sem 6-8)

- Modificadores, notas, cantidades, anti-abuso completo (§5.2).
- Toma de comanda desde el móvil del camarero (D19).
- Zonas, merge de mesas, mesas de barra.
- Horarios, días de cierre, modo cerrado con mensaje claro.
- E2E del flujo ① y ②.

### Fase 3 — Cuenta (sem 9-10)

- `packages/domain` completo: 4 modos de reparto, propinas, descuentos, cupones.
- 100 % de cobertura. Casos borde documentados.
- Solicitud de cuenta, pantalla de reparto, "el empleado lo ve y cobra".
- Cierre de mesa, registro de cobro (`checkouts`), auditoría.
- E2E del flujo ④.

### Fase 4 — Personalización y operación (sem 11-13)

- Panel del dueño completo: personal, roles, métricas, temas, logo, portada, banner.
- Multi-local: el mismo dueño con N sedes, navegación entre ellas, cuota por sede.
- Copias de seguridad semanales operativas (§7.3) + ensayo de restauración.
- E2E del flujo ③. Textos legales publicados.

### Fase 5 — Delivery (sem 14-15)

- `service_mode`, cola de pedidos, estados de preparación/entrega, alias sin datos.
- E2E del flujo ⑤.

### Fase 6 — Pilotos (sem 16+)

- Captación: landing page + lanzamiento en redes (no hay contactos, hay que crearlos).
- Onboarding de 1-3 locales: carta, mesas, QR, formación del personal.
- 4 semanas de uso real con métricas y ajustes. **Nada de funcionalidades nuevas aquí.**
- Publicación del código y de la documentación. Anuncio en la comunidad.

### Fuera de alcance (consciente)

Pagos online · integración con TPV · app nativa · impresión de tickets · programas de
fidelización · app del repartidor · rutas de reparto · propinas por empleado · multi-idioma más
allá de es/en · facturación electrónica · on-premise · app para el comensal con cuenta.

Cada uno de estos es un proyecto en sí mismo. Anotarlos aquí es la manera de que no se cuelen
"por si acaso".

---

## 9. Modelo de negocio y ética (D33)

**Principio rector:** que ningún local pequeño deje de usar la herramienta por precio, y que
quien la mantiene pueda vivir de ella.

### 9.1 La estructura que lo hace posible

```
Precio bajo  ──►  muchos locales  ──►  coste operativo bajo  ──►  margen pequeño pero suficiente
     ▲                                        │
     │                                        ▼
     └──── "sin lock-in" ◄──  AGPL + exportación abierta + autohospedaje gratuito
```

La ventaja competitiva de un actor comercial no puede ser el precio: no nos la podemos permitir.
Nuestra ventaja estructural es que **el cliente no está atrapado**. Si se va, se lleva sus
datos en JSON y puede seguir usando el software él mismo. Eso hace imposible que nos
chantajee un local, y es honesto.

### 9.2 Precios (propuesta a validar con los pilotos)

| Plan | Precio | Condiciones |
|------|--------|-------------|
| **Piloto** | 0 CLP | Primeros 6 meses, 1-3 locales, con acompañamiento |
| **Esencial** | ~3.900 CLP/mes por sede | Hasta 15 mesas |
| **Profesional** | ~6.900 CLP/mes por sede | Mesas ilimitadas, multi-sede, métricas, soporte |
| **Sponsor** | A elección | Quien quiera apoyar más; se lista públicamente en el sitio |

Los números concretos se fijan **después** del primer piloto, con datos reales de uso, no antes.
Mercado de referencia en Chile: los productos de este tipo rondan 30.000-90.000 CLP/mes, así que
el orden de magnitud es 10× menor.

### 9.3 Finanza con 0 gasto

| Concepto | Coste |
|----------|-------|
| Dominio | ~10 USD/año |
| Supabase Free / Cloudflare Pages / Workers / R2 | 0 |
| Sentry, UptimeRobot, GitHub Actions, Biome, Playwright | 0 |
| **Total mensual** | **~1 USD/mes equivalente (dominio prorrateado)** |

Escalada al primer ingreso (con la primera cuota, no antes): Supabase Pro (25 USD/mes) para
backups diarios y fin de la pausa. **Es el primer gasto, y se aprueba con la primera cuota,
no antes.**

### 9.4 Gobernanza y figura legal (D: hoy proyecto personal)

Hoy es un proyecto personal con licencia AGPL. Con los primeros locales reales hay que decidir:

1. **Cooperativa** (Ley 19.720 en Chile) — encaja con un dueño que aporta código y horas y
   locales que aportan cuota, con excedente repartido. Es la forma natural aquí.
2. **Asociación** — si la aportación es m\u00e1s simb\u00f3lica que laboral.
3. **Fundación** — si aparecefundaci\u00f3n o financiaci\u00f3n externa.

**Recomendación: exploratory a cooperativa**, porque el modelo "el dueño pone el software y el
local pone la cuota y ambosAsumen el riesgo" es literalmente la definición de cooperativa de
producción. Este es un tema jurídico real: hay que consultar a un abogado antes de cobrar la
primera cuota. **Hasta ese momento, los pilotos son gratuitos y sin compromiso contractual.**

Mientras tanto, la estrategia de blindaje es técnica y no jurídica: AGPL, repo público, sin lock-in,
transparencia de costes publicada. El código es la garantía.

### 9.5 Transparencia

Página pública de costes: "esto es lo que cuesta, esto es lo que entra, esto es lo que queda".
Una fundación que no publica sus números no es ética, es marketing.

---

## 10. Nombre, dominio y rutas

Tienes `proyectolibero.org` en Cloudflare. Recomiendo usarlo como **umbrella** y colgar el
producto debajo, porque la extensibilidad a otros proyectos del mismobushido y porque
"ProyectoLibero" ya comunica lo que queremos:

```
proyectolibero.org            → sitio del proyecto / asociación, landing, manifiesto
app.proyectolibero.org        → PWA comensal, empleado y panel (todo en un dominio)
app.proyectolibero.org/t/ABC123XYZ  → mesa (QR y NFC apuntan aquí)
app.proyectolibero.org/staff        → PWA de empleado (enlace corto, en el m\u00f3vil del local)
app.proyectolibero.org/admin        → panel del dueño
```

**Decisión pendiente de nombre de producto.** Criterios: corto, dicho en voz alta por un
camarero, sin parecido con apps de pago, que funcione en español. Candidatos a Developement
sobre esta base: *Garzón Libre*, *Mesa Abierta*, *Turno*, *Pedilo*, *Aquí se come*.
Ninguno definitivo: los nombres definitivos seonormalizan cuando haya 3 locales diciendo el
nombre en voz alta 20 veces al día. **No bloquear el desarrollo por esto: se usa un slug
neutro y se renombra en Fase 6.**

**Etiquetas NFC (D24):** solución elegida → **una sola URL canónica por mesa**, la misma para
QR y NFC. El QR es la URL impresa; el tag NFC lleva un registro NDEF de tipo URI con esa misma
URL. Consecuencia: **cualquier tag NFC con la URL de la mesa funciona**, y el local puede
comprar tags genéricos (NTAG213) en cualquier parte. Ningún pedido ni coste de nuestro lado.
El panel imprime el QR en A6 autoadhesivo con el logo del local, listo para pegar.

---

## 11. Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|--------|-------|---------|-----------|
| R1 | Supabase Free se pausa | Media | Alto | Keep-alive diario; alerta antes de pausar |
| R2 | 500 MB de BD (read-only) | Baja al inicio | Alto | Alertas al 70 %; purga de `audit_log` antiguo; fotos fuera (R2) |
| R3 | Vercel Hobby = no comercial | **Resuelto** | — | Cloudflare en su lugar (§2.1) |
| R4 | No hay locales piloto | **Alta** | Alto | La captura es la Fase 6, así que se adelanta: landing + redes en Fase 0 |
| R5 | Fidelización vs anonimato | **Resuelta** | — | Sin fidelidad en v1; código impreso en v2 |
| R6 | Bus factor = 1 | Alta | Alto | Runbooks escritos desde el día 1, AGPL, docs como activo |
| R7 | Alcance excesivo para 1 persona | Media | Medio | §8 corta explícitamente; cada fase tiene un entregable usable |
| R8 | Coupón de descuento filtrado | Media | Bajo | Validación server-side, `max_uses` atómico, auditado |
| R9 | Dependencia de proveedor único | Media | Medio | La capa de datos es Postgres estándar: migrar a Neon o Railway es un `pg_dump` |
| R10 | Local no adopta porque el mesero no lo entiende | Media | Alto | Onboarding presencial, KDS con 3 botones y nada más |
| R11 | Un local se vuelve dependiente de nuestro sistema | Media | Alto | Exportación CSV/JSON del menú, mesas, pedidos y métricas |
| R12 | Cobrar sin figura legal | Media | Alto | Pilotos gratis hasta tener la entidad; consultar abogado antes de la primera cuota |
| R13 | Agotamiento del mantenedor | Alta | Alto | Alcance realista, ritmo sostenible, y el negocio debe funcionar sin él al 100 % |

---

## 12. Métricas de éxito

**Producto (por semana, piloto)**
- Comensales que abren la carta / que envían su primera comanda → **tasa de conversión**.
- Comandas por mesa y por hora de servicio.
- Tiempo medio de `pendiente → aceptada` y de `aceptada → lista`.
- Comandas anuladas por mesa (**mide el anti-abuso real**).
- Requests de cuenta por comensal.
- Nº de empleados activos / semana.

**Negocio (mensual)**
- Locales activos (sedes).
- Ingreso recurrente / coste de infraestructura → **margen**.
- Tasa de retención de locales a 3 y 6 meses.
- Locales en plan gratuito vs de pago (y por qué).

**Éticas (publicadas)**
- Ratio precio / mercado de referencia.
- Nº de locales que siguen usando el software tras autohospedarlo gratis.
- Horas del mantenedor por local activo (si sube, el modelo no escala).

La última es la más importante y la más incómoda. Si el número sube, la cuota simbólica es
insuficiente y hay que subirla o reducir el soporte. Decidirlo con datos, no con entusiasmo
entusiasmo.

---

## 13. Decisiones pendientes (bloqueantes vs no)

**Bloqueantes para empezar la Fase 0: ninguna.** Se puede empezar mañana con un slug neutro.

**Antes de la Fase 6 (pilotos):**
1. Nombre definitivo de producto (se decide con locales, no antes).
2. Figura legal (cooperativa) — consultar abogado.
3. Cifras concretas de la cuota simbólica (con datos de uso real).
4. Textos legales revisados por alguien con oficio.

**Puede esperar a v2 y no debería bloquear nada:**
- Pago online opt-in por local.
- Programa de fidelización por código impreso.
- Impresión de comanda.
- Métricas avanzadas y exportación de datos.
- Notificaciones por correo a los empleados.
- Modo offline profundo para la toma de comanda del camarero.

---

## 14. Siguiente paso

Empezar la **Fase 0**. Primero documento `docs/ADRs/0001-stack.md` con las decisiones ya
tomadas y sus alternativas descartadas, para que en 6 meses sepas por qué se eligió Cloudflare
y no Vercel.

Luego: repositorio, esquema, RLS, CI verde. Un solo PR a la vez, cada uno con su test.
