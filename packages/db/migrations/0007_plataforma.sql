-- 0007 — Plataforma.
--
-- Tablas de soporte que no son configuracion del local ni comandas: notificaciones push,
-- estaciones de cocina, metricas agregadas, limites de peticiones y la tienda de claves
-- de idempotencia.

create table push_subscriptions (
  id uuid primary key default camarero_uuid_v7(),
  staff_id uuid not null references staff (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_ok_at timestamptz
);

comment on table push_subscriptions is
  'Suscripcion Web Push de un empleado, para avisarle de una peticion de emparejamiento o de una comanda. Las claves p256dh y auth son claves publicas del navegador, no secretos del sistema.';
comment on column push_subscriptions.staff_id is 'Empleado suscrito. on delete cascade: sin empleado la suscripcion no sirve.';
comment on column push_subscriptions.endpoint is 'Punto final de push del navegador. Unico por suscripcion.';
comment on column push_subscriptions.last_ok_at is 'Ultimo envio con exito. Sirve para podar suscripciones muertas.';

create index push_subscriptions_staff_idx on push_subscriptions (staff_id);

create trigger push_subscriptions_set_updated_at
  before update on push_subscriptions
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Estaciones de cocina
-- ---------------------------------------------------------------------------

create table kitchen_stations (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  name text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kitchen_stations_location_nombre_unico unique (location_id, name)
);

comment on table kitchen_stations is
  'Estacion del KDS de un local (parrilla, barra, postres...). Filtra las comandas que ve cada pantalla.';
comment on column kitchen_stations.kind is
  'Tipo de estacion. El contrato no enumera valores, asi que no se impone check para no inventarlos.';

create index kitchen_stations_location_idx on kitchen_stations (location_id);

create trigger kitchen_stations_set_updated_at
  before update on kitchen_stations
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Metricas diarias
-- ---------------------------------------------------------------------------

create table daily_metrics (
  location_id uuid not null references locations (id) on delete restrict,
  date date not null,
  orders integer not null default 0,
  covers integer not null default 0,
  clp_gross bigint not null default 0,
  avg_ticket_clp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_id, date),
  constraint daily_metrics_orders_no_negativo check (orders >= 0),
  constraint daily_metrics_covers_no_negativo check (covers >= 0),
  constraint daily_metrics_clp_gross_no_negativo check (clp_gross >= 0),
  constraint daily_metrics_avg_ticket_no_negativo check (avg_ticket_clp >= 0)
);

comment on table daily_metrics is
  'Agregados diarios por local. SIN NINGUN DATO PERSONAL: solo contadores y sumas de dinero. No se guarda quien pidio, ni que mesa, ni cuando. Es la unica vista de metricas del dueno.';
comment on column daily_metrics.date is 'Dia natural del local, en su zona horaria.';
comment on column daily_metrics.orders is 'Numero de comandas cerradas ese dia.';
comment on column daily_metrics.covers is 'Comensales servidos ese dia (suma de party_size conocidos).';
comment on column daily_metrics.clp_gross is
  'Bruto vendido en CLP enteros. bigint porque es un agregado y no debe desbordar.';
comment on column daily_metrics.avg_ticket_clp is 'Ticket medio en CLP enteros (bruto / comandas).';

create trigger daily_metrics_set_updated_at
  before update on daily_metrics
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Limite de peticiones
-- ---------------------------------------------------------------------------

create table ratelimit_counters (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start),
  constraint ratelimit_counters_count_no_negativo check (count >= 0)
);

comment on table ratelimit_counters is
  'Contador de peticiones por bucket y ventana temporal. El bucket codifica el ambito (por ejemplo, local o dispositivo). No tiene org_id propio: quien escriba la RLS tendra que derivarlo del bucket o tratarla como tabla de plataforma.';
comment on column ratelimit_counters.bucket is 'Clave del ambito limitado, opaca, definida por el borde.';
comment on column ratelimit_counters.window_start is 'Inicio de la ventana temporal del contador.';
comment on column ratelimit_counters.count is 'Peticiones contadas en la ventana.';

-- ---------------------------------------------------------------------------
-- Claves de idempotencia
-- ---------------------------------------------------------------------------

create table idempotency_keys (
  key text primary key,
  org_id uuid not null references orgs (id) on delete restrict,
  response_json jsonb,
  created_at timestamptz not null default now()
);

comment on table idempotency_keys is
  'Tienda de idempotencia: guarda la respuesta de una peticion ya procesada para devolverla ante un reintento. La clave es global (no por local), coherente con orders.idempotency_key.';
comment on column idempotency_keys.key is
  'Clave opaca de alta entropia generada por el cliente. Clave primaria global.';
comment on column idempotency_keys.org_id is 'Organizacion que genero la peticion. on delete restrict.';
comment on column idempotency_keys.response_json is 'Respuesta cacheada que se devuelve en un reintento con la misma clave.';
comment on column idempotency_keys.created_at is 'Momento de la peticion original. Permite podar claves antiguas.';

create index idempotency_keys_org_idx on idempotency_keys (org_id);
create index idempotency_keys_created_at_idx on idempotency_keys (created_at desc);
