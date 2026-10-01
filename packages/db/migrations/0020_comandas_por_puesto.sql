-- 0020 — La comanda se reparte por puesto: destino inmutable, alta automatica y pantallas por puesto.
--
-- CONTEXTO. La comanda se mando entera a una sola pantalla de cocina, incluidas las bebidas y
-- con precios (LL-025). El esquema ya sabia por donde va cada cosa: cada plato trae su estacion
-- de preparacion (`menu_items.prep_station`). Esta migracion le pone a la comanda SU destino,
-- que es una copia inmutable de esa estacion, y deja que los destinos que no necesitan
-- aprobacion nazcan aceptados (ADR-0033, D-048).
--
-- QUE HACE:
--   1. Anade `orders.prep_station` (copia inmutable del puesto de preparacion); las comandas
--      que ya existian conservan el destino generico de cocina, que es donde se veian.
--   2. Define cuando un destino es automatico (barra y bebidas): nace aceptado.
--   3. Deja que el ENVIO del comensal pase a aceptada su propia comanda automatica, de modo
--      que el disparador de cierre de 0013 calcule los importes. La cocina sigue esperando.
--   4. Exige que la estacion de una linea coincida con el destino de su comanda.

-- ---------------------------------------------------------------------------
-- 1. El destino de la comanda: copia inmutable de la estacion del plato
-- ---------------------------------------------------------------------------
--
-- Las comandas que ya existian se veian todas en la pantalla unica de cocina, asi que nacen
-- con el destino generico de cocina: no se reescribe su historia y siguen apareciendo donde
-- aparecian. Toda comanda nueva lo trae del borde; el DEFAULT es la red de seguridad.

alter table public.orders add column prep_station text not null default 'cocina';

comment on column public.orders.prep_station is
  'Puesto de preparacion al que va la comanda: frio, caliente, bar, postre, bebidas o cocina (un plato sin estacion). Copia inmutable: si un plato cambia de estacion manana, la comanda de ayer sigue diciendo por donde iba. Las comandas anteriores a 0020 conservan cocina, que es donde se veian.';

alter table public.orders add constraint orders_prep_station_valido check (
  prep_station in ('frio', 'caliente', 'bar', 'postre', 'bebidas', 'cocina')
);

-- ---------------------------------------------------------------------------
-- 2. El destino derivado y la regla de "nace aceptada"
-- ---------------------------------------------------------------------------

create function camarero_destino_de_estacion(p_estacion text) returns text
language sql immutable
set search_path = pg_catalog
as $$ select coalesce(nullif(p_estacion, ''), 'cocina') $$;

comment on function camarero_destino_de_estacion(text) is
  'Destino de una comanda a partir de la estacion del plato. Un plato sin estacion va a cocina, el destino generico con aprobacion humana.';

create function camarero_estacion_automatica(p_destino text) returns boolean
language sql immutable
set search_path = pg_catalog
as $$ select p_destino in ('bar', 'bebidas') $$;

comment on function camarero_estacion_automatica(text) is
  'Verdadero para los destinos que no necesitan aprobacion humana: la barra y las bebidas son automaticas (D-048, ADR-0033). Su proteccion no es la aceptacion, es que el local puede anular.';

-- ---------------------------------------------------------------------------
-- 3. La comanda automatica la acepta el propio envio
-- ---------------------------------------------------------------------------
--
-- El comensal no puede escribir una comanda (0013). Esta politica abre UNA sola puerta: pasar
-- a aceptada su propia comanda cuando su destino es automatico. No puede moverla de local ni
-- de organizacion, ni tocar los importes (los fija el disparador de cierre). Una comanda de
-- cocina no entra por aqui: sigue dependiendo de la aprobacion humana.

create policy orders_aceptar_automatica on public.orders for update
  using (
    public.es_comensal()
    and session_id = public.sesion_actual()
    and org_id = public.org_de_sesion()
    and location_id = public.local_de_sesion()
    and status = 'pendiente'
    and public.camarero_estacion_automatica(prep_station)
  )
  with check (
    public.es_comensal()
    and session_id = public.sesion_actual()
    and org_id = public.org_de_sesion()
    and location_id = public.local_de_sesion()
    and status = 'aceptada'
    and public.camarero_estacion_automatica(prep_station)
  );

comment on policy orders_aceptar_automatica on public.orders is
  'El envio de una comanda a un destino automatico (barra o bebidas) la deja aceptada. El comensal solo puede pasar a aceptada su propia comanda de un destino automatico, sin moverla de local ni de organizacion; la cocina sigue exigiendo aprobacion humana.';

-- ---------------------------------------------------------------------------
-- 4. La linea tiene que pertenecer al destino de su comanda
-- ---------------------------------------------------------------------------
--
-- Impide que una linea de cocina viaje en una comanda marcada para barra (y al reves): el
-- destino es una copia fiable, no algo que se pueda falsear. Una linea sin plato se deja
-- pasar: el disparador de precio la rechaza despues con un mensaje mas claro.

create function camarero_comprobar_destino_de_linea() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_destino text;
  v_estacion text;
begin
  if new.menu_item_id is null then
    return new;
  end if;
  select o.prep_station into v_destino
    from public.orders o
   where o.id = new.order_id;
  if v_destino is null then
    return new;
  end if;
  select m.prep_station into v_estacion
    from public.menu_items m
   where m.id = new.menu_item_id;
  if public.camarero_destino_de_estacion(v_estacion) <> v_destino then
    raise exception 'La linea % no pertenece al destino % de la comanda',
      new.menu_item_id, v_destino
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function camarero_comprobar_destino_de_linea() is
  'Disparador BEFORE INSERT de order_items: exige que la estacion del plato coincida con el destino de la comanda.';

create trigger order_items_comprobar_destino
  before insert on public.order_items
  for each row execute function camarero_comprobar_destino_de_linea();
