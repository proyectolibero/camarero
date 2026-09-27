-- 0006 — Promociones y cuenta.
--
-- Las promociones del local y el ciclo de la cuenta: el comensal pide la cuenta, el
-- sistema propone el reparto y la propina, y un empleado registra el cobro en el TPV.
-- El dinero NUNCA pasa por el sistema.

create table promotions (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  kind text not null,
  code text,
  value integer not null,
  min_subtotal_clp integer not null default 0,
  max_discount_clp integer,
  valid_from timestamptz,
  valid_to timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_location_code_unico unique (location_id, code),
  constraint promotions_kind_valido check (kind in ('percent', 'fixed', 'free_item')),
  constraint promotions_value_no_negativo check (value >= 0),
  constraint promotions_percent_rango check (kind <> 'percent' or value between 0 and 100),
  constraint promotions_min_subtotal_no_negativo check (min_subtotal_clp >= 0),
  constraint promotions_max_discount_no_negativo check (max_discount_clp is null or max_discount_clp >= 0),
  constraint promotions_max_uses_no_negativo check (max_uses is null or max_uses >= 0),
  constraint promotions_used_count_no_negativo check (used_count >= 0),
  constraint promotions_used_count_tope check (max_uses is null or used_count <= max_uses),
  constraint promotions_ventana_valida check (valid_from is null or valid_to is null or valid_from <= valid_to)
);

comment on table promotions is
  'Promocion o cupon de un local. El descuento se calcula en el dominio, nunca con float, y siempre limitado por el bruto y por max_discount_clp.';
comment on column promotions.kind is 'percent (porcentaje), fixed (monto fijo) o free_item (producto gratis).';
comment on column promotions.code is
  'Codigo del cupon, opcional. Unico por local. Un codigo filtrado obliga a desactivarlo, no a reescribir el historial (RISK-008).';
comment on column promotions.value is
  'Valor de la promocion: porcentaje entero si kind = percent, monto en CLP si kind = fixed.';
comment on column promotions.min_subtotal_clp is 'Subtotal minimo para que la promocion aplique.';
comment on column promotions.max_discount_clp is 'Tope de descuento en CLP. Nulo = sin tope explicito (sigue limitado por el bruto).';
comment on column promotions.max_uses is 'Usos maximos permitidos. Nulo = sin limite.';
comment on column promotions.used_count is 'Usos consumidos. No puede superar max_uses.';

create index promotions_location_idx on promotions (location_id);
create index promotions_activas_idx on promotions (location_id, active) where active;

create trigger promotions_set_updated_at
  before update on promotions
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Peticiones de cuenta
-- ---------------------------------------------------------------------------

create table bill_requests (
  id uuid primary key default camarero_uuid_v7(),
  session_id uuid not null references table_sessions (id) on delete restrict,
  split_mode text not null,
  tip_percent integer not null default 0,
  splits_json jsonb,
  state text not null default 'requested',
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bill_requests_split_mode_valido check (split_mode in ('by_item', 'equal', 'half', 'manual')),
  constraint bill_requests_state_valido check (
    state in ('requested', 'preparing', 'ready', 'settled', 'voided')
  ),
  constraint bill_requests_tip_percent_valido check (tip_percent in (0, 5, 10, 15, 20)),
  constraint bill_requests_splits_objeto check (splits_json is null or jsonb_typeof(splits_json) = 'object')
);

comment on table bill_requests is
  'Peticion de cuenta de una sesion, con su modo de reparto y la propina sugerida. El sistema calcula el reparto exacto; no cobra.';
comment on column bill_requests.split_mode is
  'Modo de reparto: by_item, equal, half o manual (CONTRACT-dinero).';
comment on column bill_requests.tip_percent is
  'Propina sugerida: 0, 5, 10, 15 o 20 por ciento. Se calcula sobre el subtotal ya descontado.';
comment on column bill_requests.splits_json is
  'Detalle del reparto por comensal (cuotas, lineas asignadas). Solo importes y referencias anonimas; ningun dato personal.';
comment on column bill_requests.state is 'requested, preparing, ready, settled o voided.';

create index bill_requests_session_idx on bill_requests (session_id);
create index bill_requests_estado_idx on bill_requests (state);

create trigger bill_requests_set_updated_at
  before update on bill_requests
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Cobros registrados
-- ---------------------------------------------------------------------------

create table checkouts (
  id uuid primary key default camarero_uuid_v7(),
  bill_request_id uuid references bill_requests (id) on delete set null,
  session_id uuid not null references table_sessions (id) on delete restrict,
  settled_by_staff_id uuid not null references staff (id) on delete restrict,
  payment_method text not null,
  total_clp integer not null,
  tip_clp integer not null default 0,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint checkouts_payment_method_valido check (
    payment_method in ('tpv_card', 'tpv_cash', 'tpv_other')
  ),
  constraint checkouts_total_no_negativo check (total_clp >= 0),
  constraint checkouts_tip_no_negativo check (tip_clp >= 0),
  constraint checkouts_tip_menor_total check (tip_clp <= total_clp)
);

comment on table checkouts is
  'Registro de que un empleado marco un cobro en el TPV del local. NO guarda ni debe guardar jamas numero de tarjeta, autorizacion, referencia de pago ni ningun dato del TPV: el dinero nunca pasa por el sistema y no somos una pasarela de pago. Cualquier columna que insinue lo contrario es un error.';
comment on column checkouts.bill_request_id is
  'Cuenta a la que corresponde el cobro. on delete set null: el cobro es un hecho y sobrevive al borrado de la peticion.';
comment on column checkouts.session_id is 'Sesion cobrada. on delete restrict: no se borra una sesion con cobros registrados.';
comment on column checkouts.settled_by_staff_id is
  'Empleado que registro el cobro. on delete restrict: el cobro necesita un responsable identificable.';
comment on column checkouts.payment_method is
  'Medio de pago usado en el TPV: tpv_card, tpv_cash o tpv_other. Es solo una etiqueta informativa, sin ningun dato de pago.';
comment on column checkouts.total_clp is 'Total cobrado en CLP enteros, propina incluida.';
comment on column checkouts.tip_clp is 'Propina efectivamente incluida en el total, en CLP enteros.';

create index checkouts_bill_request_idx on checkouts (bill_request_id);
create index checkouts_session_idx on checkouts (session_id);
create index checkouts_staff_idx on checkouts (settled_by_staff_id);
create index checkouts_settled_at_idx on checkouts (settled_at desc);
