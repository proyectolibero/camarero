-- 0005 — Sesiones de mesa y comandas.
--
-- La sesion de mesa une los dispositivos anonimos de una visita; la comanda es la unidad
-- que viaja a cocina. Aqui no hay ni un dato personal del comensal: solo alias y tokens
-- opacos (D-007). Los estados de la comanda son los de CONTRACT-estados-comanda.

create table table_sessions (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  table_id uuid not null references tables (id) on delete restrict,
  code text not null,
  state text not null default 'pairing',
  mode text not null default 'dine_in',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  party_size integer,
  pairing_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_sessions_state_valido check (
    state in ('pairing', 'requested', 'active', 'closed', 'voided')
  ),
  constraint table_sessions_mode_valido check (mode in ('dine_in', 'delivery')),
  constraint table_sessions_party_size_positivo check (party_size is null or party_size > 0),
  constraint table_sessions_cierre_coherente check (
    (state in ('closed', 'voided')) = (closed_at is not null)
  )
);

comment on table table_sessions is
  'Sesion de mesa: el periodo en que una mesa esta abierta y varios dispositivos anonimos pueden pedir. Cada visita empieza de cero.';
comment on column table_sessions.table_id is
  'Mesa a la que pertenece la sesion. on delete restrict: no se borra una mesa con sesiones.';
comment on column table_sessions.code is
  'Alias legible y efimero de la sesion ("Mesa 4"), sin relacion con ninguna persona.';
comment on column table_sessions.state is
  'pairing (esperando aprobacion), requested, active, closed o voided.';
comment on column table_sessions.mode is 'dine_in para mesa; delivery para la cola de retiro/entrega.';
comment on column table_sessions.party_size is 'Comensales declarados. Nulo si no se pregunto.';
comment on column table_sessions.pairing_expires_at is
  'Caducidad de la solicitud de emparejamiento (90 s). Pasado el instante, el comensal reintenta.';

create index table_sessions_location_idx on table_sessions (location_id);
create index table_sessions_table_idx on table_sessions (table_id);
create index table_sessions_code_idx on table_sessions (code);
create index table_sessions_abiertas_idx on table_sessions (table_id, opened_at)
  where state not in ('closed', 'voided');

create trigger table_sessions_set_updated_at
  before update on table_sessions
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Dispositivos anonimos de la sesion
-- ---------------------------------------------------------------------------

create table table_devices (
  id uuid primary key default camarero_uuid_v7(),
  session_id uuid not null references table_sessions (id) on delete cascade,
  device_alias text not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  constraint table_devices_alias_unico unique (session_id, device_alias)
);

comment on table table_devices is
  'Dispositivo anonimo unido a una sesion de mesa. device_alias es un hash: identifica el dispositivo dentro de la sesion, no a una persona. Sin nombre, sin telefono, sin historial.';
comment on column table_devices.device_alias is
  'Hash opaco del dispositivo. Unico dentro de la sesion, irrelevante fuera de ella.';
comment on column table_devices.last_seen is 'Ultima actividad, para el cierre por inactividad (4 h).';

-- ---------------------------------------------------------------------------
-- Solicitudes de emparejamiento
-- ---------------------------------------------------------------------------

create table pairing_requests (
  id uuid primary key default camarero_uuid_v7(),
  session_id uuid not null references table_sessions (id) on delete cascade,
  table_id uuid not null references tables (id) on delete restrict,
  state text not null default 'pending',
  decided_by uuid references staff (id) on delete set null,
  decided_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pairing_requests_state_valido check (
    state in ('pending', 'approved', 'rejected', 'expired')
  ),
  constraint pairing_requests_decision_coherente check (
    (state in ('approved', 'rejected')) = (decided_at is not null)
  ),
  constraint pairing_requests_rechazo_motivo check (state <> 'rejected' or reason is not null)
);

comment on table pairing_requests is
  'Peticion de acceso de un dispositivo a una mesa. Requiere aprobacion humana de un empleado: un escaneo de QR no abre nada por si solo.';
comment on column pairing_requests.table_id is
  'Mesa solicitada. Se guarda ademas de la sesion para poder auditar peticiones rechazadas o caducadas.';
comment on column pairing_requests.decided_by is
  'Empleado que aprobo o rechazo. on delete set null para no perder la peticion.';
comment on column pairing_requests.reason is 'Motivo del rechazo, para explicarselo al comensal.';

create index pairing_requests_session_idx on pairing_requests (session_id);
create index pairing_requests_table_estado_idx on pairing_requests (table_id, state);
create index pairing_requests_decided_by_idx on pairing_requests (decided_by);

create trigger pairing_requests_set_updated_at
  before update on pairing_requests
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Comandas
-- ---------------------------------------------------------------------------

create table orders (
  id uuid primary key default camarero_uuid_v7(),
  org_id uuid not null references orgs (id) on delete restrict,
  location_id uuid not null references locations (id) on delete restrict,
  session_id uuid references table_sessions (id) on delete set null,
  source text not null default 'table',
  placed_by_staff_id uuid references staff (id) on delete set null,
  status text not null default 'pendiente',
  client_alias text,
  subtotal_clp integer not null default 0,
  discount_clp integer not null default 0,
  total_clp integer not null default 0,
  note text,
  idempotency_key text not null,
  delivery_meta_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_idempotency_key_unico unique (idempotency_key),
  constraint orders_source_valido check (source in ('table', 'staff', 'delivery')),
  constraint orders_status_valido check (
    status in ('pendiente', 'aceptada', 'preparando', 'lista', 'servida', 'cerrada', 'anulada')
  ),
  constraint orders_importes_no_negativos check (
    subtotal_clp >= 0 and discount_clp >= 0 and total_clp >= 0
  ),
  constraint orders_total_no_supera_subtotal check (total_clp <= subtotal_clp),
  constraint orders_mesa_con_sesion check (source <> 'table' or session_id is not null),
  constraint orders_staff_con_empleado check (source <> 'staff' or placed_by_staff_id is not null)
);

comment on table orders is
  'Comanda: lo que el comensal o un empleado envia a cocina. Entra como pendiente y no puede retroceder de estado (CONTRACT-estados-comanda).';
comment on column orders.session_id is
  'Sesion de mesa de origen. Nula en pedidos de delivery; on delete set null para no perder la comanda si se limpia una sesion.';
comment on column orders.source is 'table (comensal), staff (empleado) o delivery.';
comment on column orders.placed_by_staff_id is
  'Empleado que tomo la comanda si source = staff. Nulo si la pidio la mesa.';
comment on column orders.client_alias is
  'Alias anonimo de quien pidio (por ejemplo, el alias de la sesion). Nunca un nombre real ni un telefono.';
comment on column orders.subtotal_clp is
  'Subtotal en CLP enteros segun CONTRACT-dinero: bruto menos descuento. No confundir con el bruto de las lineas.';
comment on column orders.discount_clp is 'Descuento aplicado en CLP enteros. El bruto de las lineas es subtotal_clp + discount_clp.';
comment on column orders.total_clp is
  'Total de la comanda en CLP enteros. Sin propina (la propina vive en bill_requests y checkouts). Por eso total_clp <= subtotal_clp.';
comment on column orders.idempotency_key is
  'Clave de idempotencia del envio, unica en TODO el sistema. Global y no por local: es un token opaco de alta entropia generado en cada envio, de modo que un reintento de red se deduplica aunque lo atienda otro borde; ademas coincide con la clave global de idempotency_keys.';
comment on column orders.delivery_meta_json is
  'Datos operativos del delivery que gestiona el local por su propio canal. NO debe contener datos personales del comensal.';

create index orders_org_idx on orders (org_id);
create index orders_location_idx on orders (location_id);
create index orders_session_idx on orders (session_id);
create index orders_placed_by_staff_idx on orders (placed_by_staff_id);
create index orders_abiertas_idx on orders (location_id, status)
  where status not in ('cerrada', 'anulada');
create index orders_created_at_idx on orders (created_at desc);

create trigger orders_set_updated_at
  before update on orders
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Lineas de comanda
-- ---------------------------------------------------------------------------

create table order_items (
  id uuid primary key default camarero_uuid_v7(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id uuid references menu_items (id) on delete set null,
  name_snapshot text not null,
  unit_price_clp integer not null,
  qty integer not null default 1,
  note text,
  line_total_clp integer not null,
  created_at timestamptz not null default now(),
  constraint order_items_qty_positiva check (qty > 0),
  constraint order_items_unit_price_no_negativo check (unit_price_clp >= 0),
  constraint order_items_line_total_no_negativo check (line_total_clp >= 0)
);

comment on table order_items is
  'Linea de comanda. Guarda copias inmutables del nombre y el precio del plato en el momento del pedido.';
comment on column order_items.menu_item_id is
  'Plato de la carta. on delete set null: aunque se borre el plato, la linea sobrevive con su snapshot.';
comment on column order_items.name_snapshot is
  'Nombre del plato copiado en el momento del pedido. Si el local lo renombra manana, la comanda de ayer sigue siendo verdadera.';
comment on column order_items.unit_price_clp is
  'Precio unitario copiado en el momento del pedido, sin modificadores. Si el local sube el precio, la comanda de ayer no cambia.';
comment on column order_items.line_total_clp is
  'Total de la linea: (unit_price_clp + suma de deltas de modificadores) * qty, en CLP enteros.';
comment on column order_items.note is 'Nota libre del comensal para esta linea. No es dato personal.';

create index order_items_order_idx on order_items (order_id);
create index order_items_menu_item_idx on order_items (menu_item_id);

create table order_item_modifiers (
  id uuid primary key default camarero_uuid_v7(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  option_id uuid references modifier_options (id) on delete set null,
  name_snapshot text not null,
  price_delta_clp integer not null default 0,
  created_at timestamptz not null default now(),
  constraint order_item_modifiers_delta_no_negativo check (price_delta_clp >= 0)
);

comment on table order_item_modifiers is
  'Modificador aplicado a una linea, con su nombre y delta copiados en el momento del pedido.';
comment on column order_item_modifiers.option_id is
  'Opcion de la carta. on delete set null: el snapshot preserva lo que se pidio.';
comment on column order_item_modifiers.name_snapshot is 'Nombre del modificador copiado al pedir.';
comment on column order_item_modifiers.price_delta_clp is 'Delta de precio copiado al pedir, en CLP enteros.';

create index order_item_modifiers_linea_idx on order_item_modifiers (order_item_id);
create index order_item_modifiers_option_idx on order_item_modifiers (option_id);
