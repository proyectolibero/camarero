-- 0004 — Carta.
--
-- Categorias, platos y modificadores de un local. Todo el dinero aqui es entero de pesos
-- chilenos: nunca float ni numeric con decimales (CONTRACT-dinero). El precio de una
-- comanda se calcula desde estas tablas, nunca desde el cliente.

create table menu_categories (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  name_i18n jsonb not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_categories_location_nombre_unico unique (location_id, name_i18n),
  constraint menu_categories_name_objeto check (jsonb_typeof(name_i18n) = 'object'),
  constraint menu_categories_sort_no_negativo check (sort_order >= 0)
);

comment on table menu_categories is
  'Categoria de la carta (entrantes, bebidas...). Organiza la vista del comensal y el orden del KDS.';
comment on column menu_categories.name_i18n is
  'Nombre traducible en formato {"es": "...", "en": "..."}. Se exige que sea un objeto JSON.';
comment on column menu_categories.sort_order is 'Orden de presentacion dentro de la carta. Menor va antes.';
comment on column menu_categories.active is 'false oculta la categoria de la carta sin borrarla.';
comment on column menu_categories.available is 'false indica agotada temporalmente; distinto de active, que es la baja definitiva.';

create index menu_categories_location_idx on menu_categories (location_id);

create trigger menu_categories_set_updated_at
  before update on menu_categories
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Platos
-- ---------------------------------------------------------------------------

create table menu_items (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  category_id uuid references menu_categories (id) on delete set null,
  name_i18n jsonb not null,
  description_i18n jsonb,
  price_clp integer not null,
  photo_r2_key text,
  allergens text[] not null default '{}',
  tags text[] not null default '{}',
  prep_station text,
  available boolean not null default true,
  available_from time,
  available_until time,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_precio_no_negativo check (price_clp >= 0),
  constraint menu_items_name_objeto check (jsonb_typeof(name_i18n) = 'object'),
  constraint menu_items_descripcion_objeto check (
    description_i18n is null or jsonb_typeof(description_i18n) = 'object'
  ),
  constraint menu_items_tags_valido check (
    tags <@ array['vegetariano', 'vegano', 'sin_gluten', 'picante']::text[]
  ),
  constraint menu_items_prep_station_valido check (
    prep_station is null or prep_station in ('frio', 'caliente', 'bar', 'postre', 'bebidas')
  ),
  constraint menu_items_sort_no_negativo check (sort_order >= 0),
  constraint menu_items_ventana_coherente check (
    available_from is null or available_until is null or available_from <= available_until
  )
);

comment on table menu_items is
  'Plato o bebida de la carta. El precio vive aqui y solo aqui: es la unica fuente valida para calcular una comanda.';
comment on column menu_items.category_id is
  'Categoria del plato. on delete set null: borrar una categoria no borra platos, los deja sin clasificar.';
comment on column menu_items.price_clp is
  'Precio en pesos chilenos, entero. Nunca float. El precio nunca viene del cliente.';
comment on column menu_items.allergens is
  'Alergenos declarados. El contrato no enumera los valores, asi que no se impone check. Responsabilidad del local (D-022).';
comment on column menu_items.tags is
  'Etiquetas dieteticas: vegetariano, vegano, sin_gluten, picante.';
comment on column menu_items.prep_station is
  'Estacion que prepara el plato: frio, caliente, bar, postre o bebidas. Sirve para filtrar el KDS.';
comment on column menu_items.available is 'false lo marca agotado temporalmente.';
comment on column menu_items.available_from is
  'Hora del dia desde la que se ofrece (por ejemplo, desayunos). Nula = todo el dia.';
comment on column menu_items.available_until is 'Hora del dia hasta la que se ofrece. Nula = sin limite.';
comment on column menu_items.active is 'false lo retira de la carta sin borrar el historial de comandas que lo citan.';

create index menu_items_location_idx on menu_items (location_id);
create index menu_items_category_idx on menu_items (category_id);

create trigger menu_items_set_updated_at
  before update on menu_items
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Grupos de modificadores
-- ---------------------------------------------------------------------------

create table modifier_groups (
  id uuid primary key default camarero_uuid_v7(),
  location_id uuid not null references locations (id) on delete restrict,
  name_i18n jsonb not null,
  min_select integer not null default 0,
  max_select integer,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_groups_name_objeto check (jsonb_typeof(name_i18n) = 'object'),
  constraint modifier_groups_min_no_negativo check (min_select >= 0),
  constraint modifier_groups_max_valido check (max_select is null or max_select >= 1),
  constraint modifier_groups_rango check (max_select is null or max_select >= min_select),
  constraint modifier_groups_required_coherente check (not required or min_select >= 1)
);

comment on table modifier_groups is
  'Grupo de opciones que se ofrecen con un plato (punto de coccion, extras...). Define cuantas opciones hay que elegir.';
comment on column modifier_groups.name_i18n is 'Nombre traducible del grupo en formato {"es": ..., "en": ...}.';
comment on column modifier_groups.min_select is 'Minimo de opciones a marcar. 0 si el grupo es opcional.';
comment on column modifier_groups.max_select is 'Maximo de opciones a marcar. Nulo = sin limite.';
comment on column modifier_groups.required is 'true exige elegir al menos una opcion (equivale a min_select >= 1).';

create index modifier_groups_location_idx on modifier_groups (location_id);

create trigger modifier_groups_set_updated_at
  before update on modifier_groups
  for each row execute function camarero_set_updated_at();

create table modifier_options (
  id uuid primary key default camarero_uuid_v7(),
  group_id uuid not null references modifier_groups (id) on delete cascade,
  name_i18n jsonb not null,
  price_delta_clp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_options_name_objeto check (jsonb_typeof(name_i18n) = 'object'),
  constraint modifier_options_delta_no_negativo check (price_delta_clp >= 0)
);

comment on table modifier_options is
  'Opcion concreta de un grupo de modificadores. Su delta se suma al precio de la linea.';
comment on column modifier_options.group_id is 'Grupo al que pertenece. on delete cascade: una opcion sin grupo no existe.';
comment on column modifier_options.price_delta_clp is
  'Diferencia de precio en CLP enteros que anade la opcion. La regla de dinero exige importes >= 0; si algun dia hacen falta modificadores que resten, hay que relajar este check en una migracion nueva.';

create index modifier_options_group_idx on modifier_options (group_id);

create trigger modifier_options_set_updated_at
  before update on modifier_options
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Que grupos ofrece cada plato
-- ---------------------------------------------------------------------------

create table item_modifier_groups (
  item_id uuid not null references menu_items (id) on delete cascade,
  group_id uuid not null references modifier_groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, group_id)
);

comment on table item_modifier_groups is
  'Relacion N:M entre platos y grupos de modificadores: que grupos se ofrecen con cada plato.';

create index item_modifier_groups_group_idx on item_modifier_groups (group_id);
