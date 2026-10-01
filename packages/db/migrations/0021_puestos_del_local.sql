-- 0021 — Los puestos del local: los nombra el dueno y reparten la carta.
--
-- CONTEXTO (ADR-0034, LL-025). La tabla `kitchen_stations` llevaba desde 0007 vacia y sin
-- usar, porque el reparto se dejo en cinco valores fijos del codigo ('frio', 'caliente',
-- 'bar', 'postre', 'bebidas' mas el generico 'cocina'). El dueno pidio nombrar el mismo los
-- puestos de su local. Esta migracion convierte los puestos en DATOS del local:
--
--   1. `kitchen_stations` gana orden, activo, `auto_accept` (nace aceptado) y `is_default`
--      (el puesto del local al que cae un plato sin destino).
--   2. `menu_categories` gana su puesto por defecto y `menu_items` puede anularlo.
--   3. La comanda congela el IDENTIFICADOR del puesto (para filtrar) y su NOMBRE (para que
--      renombrarlo no reescriba la historia). El `prep_station` viejo pasa a ser ese nombre.
--   4. Se migran los datos que ya existian SIN perder ni duplicar: cada local recibe los
--      puestos de la vieja lista fija y cada plato/comanda se enlaza al suyo.
--   5. Un local nuevo nace con un juego por defecto (disparador sobre `locations`).
--
-- El reparto deja de estar en el codigo: el puesto de un plato es
-- `menu_items.prep_station_id` y, si no lo trae, `menu_categories.prep_station_id`; si
-- tampoco, el puesto por defecto del local. La herencia categoria -> plato es lo que hace
-- usable una carta de cien bebidas (D-048).

-- ---------------------------------------------------------------------------
-- 1. Los puestos del local: orden, activo, auto-aceptado y por defecto
-- ---------------------------------------------------------------------------

alter table public.kitchen_stations
  add column sort_order integer not null default 0,
  add column active boolean not null default true,
  add column auto_accept boolean not null default false,
  add column is_default boolean not null default false;

comment on column public.kitchen_stations.name is
  'Nombre del puesto, lo pone el dueno (Parrilla, Plancha, Postre, Barra). Unico por local.';
comment on column public.kitchen_stations.sort_order is
  'Orden de presentacion de los puestos en el panel y en la navegacion de las pantallas.';
comment on column public.kitchen_stations.active is
  'false retira el puesto sin borrarlo: desaparece de las pantallas y del formulario de la carta.';
comment on column public.kitchen_stations.auto_accept is
  'true hace que las comandas de este puesto nazcan aceptadas, sin aprobacion humana. Es una PROPIEDAD del puesto, no una lista del codigo (ADR-0033, D-048).';
comment on column public.kitchen_stations.is_default is
  'Puesto por defecto del local: a el van los platos que no heredan puesto de su categoria ni lo traen propio. Exactamente uno por local.';

alter table public.kitchen_stations
  add constraint kitchen_stations_sort_no_negativo check (sort_order >= 0);

-- Exactamente un puesto por defecto por local. Indice unico parcial: los no-default no chocan.
create unique index kitchen_stations_default_unico
  on public.kitchen_stations (location_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- 2. Migrar los puestos de la vieja lista fija a datos del local
-- ---------------------------------------------------------------------------
--
-- La RLS esta activada y FORZADA desde 0010. El backfill lee `locations`, `menu_items` y
-- `orders` para enlazarlos con su puesto, y al ejecutarse la migracion como camarero_owner
-- (sin contexto de actor) esas lecturas devolverian cero filas. Se apaga la RLS SOLO dentro
-- de esta transaccion y se vuelve a encender al terminar; si algo falla, el ROLLBACK tambien
-- revierte el apagado y el esquema queda intacto.
alter table public.locations disable row level security;
alter table public.menu_categories disable row level security;
alter table public.menu_items disable row level security;
alter table public.orders disable row level security;
alter table public.kitchen_stations disable row level security;
--
-- Cada local existente recibe un puesto por cada valor del `check` viejo. El nombre es el de
-- la lista fija en español; el dueno puede renombrarlo. `auto_accept` conserva el
-- comportamiento anterior: barra y bebidas nacian aceptadas. `Cocina` es el puesto por
-- defecto, el destino de un plato sin estacion.
--
-- `kind` deja de ser un campo sin uso: guarda el codigo de la lista vieja para poder enlazar
-- los datos que ya existian. No impone un `check`: el dueno puede crear puestos nuevos.

insert into public.kitchen_stations
  (location_id, name, kind, sort_order, auto_accept, is_default)
select l.id, v.nombre, v.codigo, v.orden, v.auto, v.defecto
  from public.locations l
  cross join (values
    ('cocina',   'Cocina',   0, false, true),
    ('frio',     'Frío',     1, false, false),
    ('caliente', 'Caliente', 2, false, false),
    ('postre',   'Postre',   3, false, false),
    ('bar',      'Barra',    4, true,  false),
    ('bebidas',  'Bebidas',  5, true,  false)
  ) as v(codigo, nombre, orden, auto, defecto)
on conflict (location_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- 3. La categoria trae el puesto; el plato puede anularlo
-- ---------------------------------------------------------------------------

alter table public.menu_categories
  add column prep_station_id uuid references public.kitchen_stations (id) on delete set null;

comment on column public.menu_categories.prep_station_id is
  'Puesto por defecto de la categoria. Todas sus fichas lo heredan salvo que el plato lo anule (ADR-0034). on delete set null: borrar el puesto no deja la categoria rota.';

alter table public.menu_items
  add column prep_station_id uuid references public.kitchen_stations (id) on delete set null;

comment on column public.menu_items.prep_station_id is
  'Puesto propio del plato. Nulo significa heredar el de su categoria y, si tampoco, el del local. Anula la herencia.';

-- Enlaza cada plato con el puesto de su local cuyo codigo viejo coincide.
update public.menu_items mi
   set prep_station_id = ks.id
  from public.kitchen_stations ks
 where ks.location_id = mi.location_id
   and ks.kind = mi.prep_station;

-- Enlaza cada comanda con el puesto de su local cuyo codigo viejo coincide.
alter table public.orders
  add column prep_station_id uuid references public.kitchen_stations (id) on delete set null;

comment on column public.orders.prep_station_id is
  'Puesto real de la comanda, congelado al enviar para poder filtrar cada pantalla. on delete set null: borrar el puesto no borra la historia.';

update public.orders o
   set prep_station_id = ks.id
  from public.kitchen_stations ks
 where ks.location_id = o.location_id
   and ks.kind = o.prep_station;

-- El nombre del puesto deja de ser un codigo con lista fija: pasa a ser el nombre congelado.
alter table public.orders drop constraint orders_prep_station_valido;

comment on column public.orders.prep_station is
  'NOMBRE del puesto congelado al enviar. Si el dueno renombra el puesto manana, la comanda de ayer sigue diciendo por donde iba (ADR-0034). Las comandas anteriores a 0021 conservan el nombre del puesto migrado.';

-- El plato ya no guarda una estacion con lista fija: guarda el puesto (arriba).
alter table public.menu_items drop constraint menu_items_prep_station_valido;
alter table public.menu_items drop column prep_station;

create index menu_categories_prep_station_idx on public.menu_categories (prep_station_id);
create index menu_items_prep_station_idx on public.menu_items (prep_station_id);
create index orders_prep_station_idx on public.orders (prep_station_id);

-- Se vuelve a encender la RLS (FORCE sigue puesto desde 0010) para el resto del esquema.
alter table public.locations enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.kitchen_stations enable row level security;

-- ---------------------------------------------------------------------------
-- 4. El puesto real de un plato: plato -> categoria -> defecto del local
-- ---------------------------------------------------------------------------
--
-- SECURITY INVOKER a proposito: la lectura hereda la visibilidad de quien actua, igual que
-- el disparador que la usa (LL-011). El comensal puede leer su carta y los puestos de su
-- local (politica de 0010, ampliada mas abajo), que es todo lo que necesita.

create function camarero_estacion_de_plato(p_item uuid) returns uuid
language sql stable security invoker
set search_path = pg_catalog
as $$
  select coalesce(
    (select mi.prep_station_id from public.menu_items mi where mi.id = p_item),
    (select mc.prep_station_id
       from public.menu_categories mc
      where mc.id = (select mi.category_id from public.menu_items mi where mi.id = p_item)),
    (select ks.id
       from public.kitchen_stations ks
      where ks.is_default
        and ks.location_id = (select mi.location_id from public.menu_items mi where mi.id = p_item))
  )
$$;

comment on function camarero_estacion_de_plato(uuid) is
  'Puesto real de un plato: el suyo, si lo trae; el de su categoria, si no; y el puesto por defecto del local como ultimo recurso. Un plato nunca se queda sin destino.';

-- ---------------------------------------------------------------------------
-- 5. El disparador sigue mordiendo: la linea pertenece al puesto de su comanda
-- ---------------------------------------------------------------------------

create or replace function camarero_comprobar_destino_de_linea() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_destino uuid;
  v_estacion uuid;
begin
  if new.menu_item_id is null then
    return new;
  end if;
  select o.prep_station_id into v_destino
    from public.orders o
   where o.id = new.order_id;
  if v_destino is null then
    return new;
  end if;
  v_estacion := public.camarero_estacion_de_plato(new.menu_item_id);
  if v_estacion is distinct from v_destino then
    raise exception 'La linea % no pertenece al puesto de la comanda', new.menu_item_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function camarero_comprobar_destino_de_linea() is
  'Disparador BEFORE INSERT de order_items: exige que el puesto REAL del plato (propio, heredado de la categoria o el defecto del local) coincida con el puesto congelado de su comanda.';

-- ---------------------------------------------------------------------------
-- 6. El auto-aceptado es una propiedad del puesto, no una lista del codigo
-- ---------------------------------------------------------------------------
--
-- 0020 fijo en una funcion que barra y bebidas nacian aceptadas. Eso era una lista escrita
-- en el codigo. Ahora lo dice el puesto. La politica del comensal comprueba la propiedad.

drop policy if exists orders_aceptar_automatica on public.orders;

create policy orders_aceptar_automatica on public.orders for update
  using (
    public.es_comensal()
    and session_id = public.sesion_actual()
    and org_id = public.org_de_sesion()
    and location_id = public.local_de_sesion()
    and status = 'pendiente'
    and exists (
      select 1 from public.kitchen_stations ks
       where ks.id = prep_station_id and ks.auto_accept
    )
  )
  with check (
    public.es_comensal()
    and session_id = public.sesion_actual()
    and org_id = public.org_de_sesion()
    and location_id = public.local_de_sesion()
    and status = 'aceptada'
    and exists (
      select 1 from public.kitchen_stations ks
       where ks.id = prep_station_id and ks.auto_accept
    )
  );

comment on policy orders_aceptar_automatica on public.orders is
  'El envio de una comanda a un puesto auto-aceptado la deja aceptada. La propiedad vive en kitchen_stations.auto_accept: no es una lista del codigo. La cocina sigue exigiendo aprobacion humana.';

drop function if exists camarero_estacion_automatica(text);
drop function if exists camarero_destino_de_estacion(text);

-- ---------------------------------------------------------------------------
-- 7. El comensal puede leer los puestos de su local
-- ---------------------------------------------------------------------------
--
-- Lo necesita la politica de auto-aceptado para saber si su puesto nace aceptado. Son
-- nombres y una marca, sin ningun dato sensible; el comensal ya ve la carta de su local.
-- Sin sesion (o de otro local) no ve ninguna fila: el defecto sigue siendo denegar.

drop policy if exists kitchen_stations_select on public.kitchen_stations;

create policy kitchen_stations_select on public.kitchen_stations for select
  using (
    public.ve_local_personal(location_id)
    or public.en_mi_local_comensal(location_id)
  );

-- ---------------------------------------------------------------------------
-- 8. Un local nuevo nace con su juego de puestos por defecto
-- ---------------------------------------------------------------------------
--
-- El dueño no tiene que configurar nada para empezar: un local nuevo trae los puestos de la
-- lista historica y funciona. Su 'Cocina' es el defecto y su 'Barra' nace aceptada, que es
-- el comportamiento que el producto ya tenia. Crea, renombra y desactiva a partir de ahi.

create function camarero_sembrar_puestos_del_local() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  insert into public.kitchen_stations
    (location_id, name, kind, sort_order, auto_accept, is_default)
  values
    (new.id, 'Cocina',   'cocina',   0, false, true),
    (new.id, 'Frío',     'frio',     1, false, false),
    (new.id, 'Caliente', 'caliente', 2, false, false),
    (new.id, 'Postre',   'postre',   3, false, false),
    (new.id, 'Barra',    'bar',      4, true,  false),
    (new.id, 'Bebidas',  'bebidas',  5, true,  false);
  return new;
end;
$$;

comment on function camarero_sembrar_puestos_del_local() is
  'Disparador AFTER INSERT de locations: crea el juego de puestos por defecto para que un local nuevo funcione sin configurar nada.';

create trigger locations_sembrar_puestos
  after insert on public.locations
  for each row execute function camarero_sembrar_puestos_del_local();
