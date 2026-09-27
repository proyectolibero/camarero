-- 0002 — Organizaciones, locales y plano de mesas.
--
-- Primer eslabon del modelo: la organizacion (dueno), sus locales y el plano fisico de
-- cada local (zonas, mesas y uniones de mesas). Aqui viven tambien las dos funciones
-- genericas que reutilizan las migraciones siguientes.
--
-- Identificadores: el contrato prohibe secuencias y pide UUID no predecibles. Se
-- comprobo en el contenedor (PostgreSQL 17.11) que `select uuidv7();` falla porque esa
-- funcion llega en PostgreSQL 18. Por eso se implementa `camarero_uuid_v7()`: 48 bits de
-- milisegundos en la parte alta y 74 bits aleatorios, segun RFC 9562. No se usa SERIAL ni
-- secuencias en ninguna tabla.

-- ---------------------------------------------------------------------------
-- Funciones comunes
-- ---------------------------------------------------------------------------

create function camarero_uuid_v7()
returns uuid
language plpgsql
volatile
as $$
declare
  milisegundos bigint;
  aleatorio text;
begin
  milisegundos := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  aleatorio := replace(gen_random_uuid()::text, '-', '');
  return (
    lpad(to_hex(milisegundos), 12, '0')
    || '7' || substr(aleatorio, 1, 3)
    || '8' || substr(aleatorio, 4, 3)
    || substr(aleatorio, 7, 12)
  )::uuid;
end;
$$;

comment on function camarero_uuid_v7() is
  'Genera un UUIDv7 (RFC 9562) sin depender de la version del motor: 48 bits de tiempo en la parte alta y 74 bits aleatorios. PostgreSQL 17 no trae uuidv7(); por eso existe esta funcion.';

create function camarero_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function camarero_set_updated_at() is
  'Trigger generico: reescribe updated_at con la hora de la transaccion en cada update. Se engancha a toda tabla mutable que tenga updated_at.';

-- ---------------------------------------------------------------------------
-- Organizaciones
-- ---------------------------------------------------------------------------

create table orgs (
  id uuid primary key default camarero_uuid_v7(),
  name text not null,
  legal_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orgs_nombre_no_vacio check (length(btrim(name)) > 0)
);

comment on table orgs is
  'Organizacion (dueno). Agrupa los locales de un mismo dueno y es la raiz del aislamiento por RLS mediante current_setting(''app.org_id'').';
comment on column orgs.name is 'Nombre comercial de la organizacion.';
comment on column orgs.legal_name is 'Razon social legal. Nula hasta que el dueno la complete.';
comment on column orgs.plan is
  'Plan de servicio. El contrato no enumera valores, asi que no se impone check para no inventarlos. Valor inicial: free.';

create trigger orgs_set_updated_at
  before update on orgs
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Locales
-- ---------------------------------------------------------------------------

create table locations (
  id uuid primary key default camarero_uuid_v7(),
  org_id uuid not null references orgs (id) on delete restrict,
  slug text not null,
  name text not null,
  timezone text not null default 'America/Santiago',
  currency text not null default 'CLP',
  theme_json jsonb,
  logo_r2_key text,
  cover_r2_key text,
  status text not null default 'draft',
  service_mode text not null default 'dine_in',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_org_slug_unico unique (org_id, slug),
  constraint locations_slug_formato check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  constraint locations_status_valido check (status in ('draft', 'active', 'paused')),
  constraint locations_service_mode_valido check (service_mode in ('dine_in', 'delivery', 'both')),
  constraint locations_currency_solo_clp check (currency = 'CLP')
);

comment on table locations is
  'Local o sede fisica. Un dueno puede tener varias; cada local es la unidad de operacion, de carta y de KDS.';
comment on column locations.org_id is
  'Organizacion propietaria. on delete restrict: borrar una org con locales vivos es un error, no un efecto colateral.';
comment on column locations.slug is 'Identificador legible en la URL de la PWA del comensal. Unico dentro de la organizacion.';
comment on column locations.timezone is 'Zona horaria del local (IANA). Todo calculo de horarios y metricas diarias la respeta.';
comment on column locations.currency is 'Moneda. Fija CLP: el pais piloto es Chile y los importes son enteros de peso.';
comment on column locations.theme_json is 'Aspectos visuales de la PWA (colores, tipografia). Nunca contiene datos de personas.';
comment on column locations.logo_r2_key is 'Clave del logo en R2. No es una URL publica; se firma al servirla.';
comment on column locations.cover_r2_key is 'Clave de la imagen de portada en R2.';
comment on column locations.status is
  'Estado del local: draft (en montaje), active (en servicio) o paused (cerrado temporalmente). Retirar un local se hace pausandolo, no borrandolo.';
comment on column locations.service_mode is
  'Modo de servicio: dine_in (solo mesa), delivery (solo retiro/entrega) o both. El delivery no exige emparejamiento de mesa.';

create index locations_org_idx on locations (org_id);

create trigger locations_set_updated_at
  before update on locations
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Horarios
-- ---------------------------------------------------------------------------

create table opening_hours (
  location_id uuid not null references locations (id) on delete cascade,
  weekday smallint not null,
  opens_at time,
  closes_at time,
  closed boolean not null default false,
  primary key (location_id, weekday),
  constraint opening_hours_weekday_rango check (weekday between 0 and 6),
  constraint opening_hours_horario_coherente check (
    (closed and opens_at is null and closes_at is null)
    or (not closed and opens_at is not null and closes_at is not null)
  )
);

comment on table opening_hours is
  'Horario semanal del local: una fila por dia de la semana. No guarda excepciones por fecha; eso sera otra tabla si llega a hacer falta.';
comment on column opening_hours.weekday is 'Dia de la semana, 0 = domingo y 6 = sabado (igual que extract(dow)).';
comment on column opening_hours.opens_at is 'Hora de apertura. Nula si el local esta cerrado ese dia.';
comment on column opening_hours.closes_at is
  'Hora de cierre. Puede ser menor que opens_at para indicar cierre despues de medianoche; esa interpretacion vive en el dominio.';
comment on column opening_hours.closed is 'true si el local no abre ese dia.';

-- ---------------------------------------------------------------------------
-- Zonas
-- ---------------------------------------------------------------------------

create table zones (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  name text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zones_location_nombre_unico unique (location_id, name),
  constraint zones_kind_valido check (kind in ('sala', 'barra', 'terraza', 'delivery'))
);

comment on table zones is
  'Agrupacion del plano de mesas (sala, barra, terraza, delivery). Sirve para organizar y filtrar el KDS.';
comment on column zones.kind is 'Tipo de zona: sala, barra, terraza o delivery.';

create index zones_location_idx on zones (location_id);

create trigger zones_set_updated_at
  before update on zones
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Mesas
-- ---------------------------------------------------------------------------

create table tables (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  zone_id uuid references zones (id) on delete set null,
  label text not null,
  code text not null,
  capacity integer not null default 2,
  kind text not null default 'mesa',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tables_location_code_unico unique (location_id, code),
  constraint tables_code_formato check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  constraint tables_capacity_positiva check (capacity > 0),
  constraint tables_kind_valido check (kind in ('mesa', 'barra'))
);

comment on table tables is
  'Mesa fisica del local. Su code se imprime en el QR/NFC y abre una sesion de mesa cuando el comensal lo escanea.';
comment on column tables.zone_id is
  'Zona a la que pertenece la mesa. Nula si aun no se ha ubicado. on delete set null: borrar una zona no borra mesas ni comandas.';
comment on column tables.label is 'Nombre que ve el personal y el comensal ("Mesa 4", "Barra 2").';
comment on column tables.code is
  'Codigo de 8 caracteres en base32 sin 0, O, 1 ni I, para poder dictarlo por telefono sin ambiguedad. Unico por local.';
comment on column tables.capacity is 'Comensales previstos. Se usa para sugerencias, no como tope duro.';
comment on column tables.kind is 'mesa o barra.';
comment on column tables.active is 'false para retirar una mesa sin borrar su historial de sesiones y comandas.';

create index tables_location_idx on tables (location_id);
create index tables_zone_idx on tables (zone_id);

create trigger tables_set_updated_at
  before update on tables
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Union de mesas
-- ---------------------------------------------------------------------------

create table table_links (
  group_id uuid not null references tables (id) on delete cascade,
  table_id uuid not null references tables (id) on delete cascade,
  role text not null default 'secondary',
  created_at timestamptz not null default now(),
  primary key (group_id, table_id),
  constraint table_links_role_valido check (role in ('primary', 'secondary'))
);

comment on table table_links is
  'Union (merge) de mesas: varias mesas forman una sola para una sesion. group_id es el id de la mesa principal; no hay tabla de grupos porque el contrato no la define.';
comment on column table_links.group_id is 'Mesa principal del grupo. on delete cascade: sin la mesa principal la union no significa nada.';
comment on column table_links.table_id is 'Mesa que se une al grupo. Puede ser la propia principal (role primary) o una secundaria.';
comment on column table_links.role is 'primary para la mesa que da nombre al grupo, secondary para las demas.';

create index table_links_table_idx on table_links (table_id);
