-- 0012 — Integridad de importes: el precio lo fija la base, nunca el cliente.
--
-- CONTEXTO. El esquema dejaba pasar esto: un comensal podia insertar una linea de comanda
-- con unit_price_clp = 1 y una comanda con discount_clp igual al bruto y total_clp = 0. El
-- precio de la carta se ignoraba y la cuenta quedaba a cero. Era un agujero de dinero.
--
-- DISENO (ADR-0014, ADR-0015, D-039). El precio y el nombre se copian de la carta en el
-- momento del pedido, mediante disparadores BEFORE sobre la propia fila que SOLO LEEN las
-- tablas de la carta. El comensal no necesita escribir la comanda: le basta con insertar
-- lineas, y `order_items_insert` ya se lo permite. Los totales de la comanda se cierran
-- aparte, cuando el personal la acepta (migracion siguiente).
--
-- Por que disparadores sobre la propia fila y no UPDATE cruzados: escribir la linea desde
-- el disparador de modificadores es un UPDATE que, con contexto de comensal, afecta a 0
-- filas en silencio (LL-007). Aqui se toca UNICAMENTE la fila que se esta insertando.
--
-- SEGURIDAD. Las funciones van SECURITY INVOKER (el modo por defecto) con
-- `search_path = pg_catalog` y referencias cualificadas con `public.`. Se eligio INVOKER
-- tras comprobarlo con experimentos: un SECURITY DEFINER lee la carta COMO SU DUENO, no
-- como el llamante, y eso obligaba a decidir entre un dueno sin privilegios (que sin
-- contexto no ve ningun plato y falla) o un dueno superusuario (que si ve, pero abre dos
-- agujeros probados: un comensal puede valorar un plato de OTRA organizacion y saltarse el
-- filtro de disponibilidad). Con INVOKER, la lectura de la carta hereda exactamente la
-- visibilidad de quien pide: solo su local y solo lo disponible. El precio sale de la base
-- igual, y ademas no escala privilegios.
--
-- El `SET search_path = pg_catalog` se aplica tambien en modo INVOKER: sigue evitando que
-- un esquema del llamante secuestre la resolucion de nombres.

-- ---------------------------------------------------------------------------
-- El nombre del plato, de su JSON al snapshot de la linea
-- ---------------------------------------------------------------------------

create function camarero_nombre_i18n(p_nombre jsonb) returns text
language sql immutable
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(p_nombre->>'es', ''),
    nullif(p_nombre->>'en', ''),
    nullif(p_nombre->>'pt', ''),
    p_nombre::text
  )
$$;

comment on function camarero_nombre_i18n(jsonb) is
  'Extrae el nombre legible de un campo i18n {"es": "...", "en": "..."}. Prefiere es, luego en, luego pt, y si no hay ninguno devuelve el propio JSON como texto para no perder la linea.';

-- ---------------------------------------------------------------------------
-- El precio de la linea lo pone la carta, no el cliente
-- ---------------------------------------------------------------------------

create function camarero_fijar_precio_de_linea() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_plato public.menu_items%rowtype;
begin
  -- Sin plato de la carta no se puede fijar un precio: una linea anonima seria un precio
  -- inventado. Se rechaza en vez de confiar en lo que venga del borde.
  if new.menu_item_id is null then
    raise exception 'La linea necesita un menu_item_id para fijar su precio'
      using errcode = 'check_violation';
  end if;

  select * into v_plato
    from public.menu_items m
   where m.id = new.menu_item_id;

  if not found then
    raise exception 'El plato % no existe en ninguna carta', new.menu_item_id
      using errcode = 'check_violation';
  end if;

  -- Se ignora lo que haya enviado el cliente: nombre y precio se copian de la carta.
  -- La llamada va cualificada: el search_path de esta funcion es solo pg_catalog, para
  -- que nadie pueda secuestrarla, y por tanto un nombre sin `public.` no resuelve.
  new.name_snapshot := public.camarero_nombre_i18n(v_plato.name_i18n);
  new.unit_price_clp := v_plato.price_clp;
  -- El total de la linea arranca con el precio base. Los modificadores se suman al cerrar
  -- la comanda, porque en este instante aun no existen.
  new.line_total_clp := v_plato.price_clp * new.qty;

  return new;
end;
$$;

comment on function camarero_fijar_precio_de_linea() is
  'Disparador BEFORE INSERT de order_items: copia nombre y precio de menu_items e ignora lo que envie el cliente. Es SECURITY INVOKER a proposito: lee la carta con la visibilidad de quien pide, de modo que no puede valorar un plato que no ve (de otro local o agotado). Si el plato no esta en su carta, rechaza la linea.';

create trigger order_items_fijar_precio
  before insert on order_items
  for each row execute function camarero_fijar_precio_de_linea();

-- ---------------------------------------------------------------------------
-- El delta del modificador lo pone la carta, no el cliente
-- ---------------------------------------------------------------------------

create function camarero_fijar_delta_de_modificador() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_opcion public.modifier_options%rowtype;
begin
  if new.option_id is null then
    raise exception 'El modificador necesita un option_id para fijar su delta'
      using errcode = 'check_violation';
  end if;

  select * into v_opcion
    from public.modifier_options o
   where o.id = new.option_id;

  if not found then
    raise exception 'La opcion de modificador % no existe en la carta', new.option_id
      using errcode = 'check_violation';
  end if;

  new.name_snapshot := public.camarero_nombre_i18n(v_opcion.name_i18n);
  new.price_delta_clp := v_opcion.price_delta_clp;

  return new;
end;
$$;

comment on function camarero_fijar_delta_de_modificador() is
  'Disparador BEFORE INSERT de order_item_modifiers: copia nombre y delta de modifier_options e ignora lo que envie el cliente. Es SECURITY INVOKER por el mismo motivo que el de las lineas: solo se puede aplicar un modificador que quien pide puede ver.';

create trigger order_item_modifiers_fijar_delta
  before insert on order_item_modifiers
  for each row execute function camarero_fijar_delta_de_modificador();

-- ---------------------------------------------------------------------------
-- Comentarios de dinero: alineados con D-039
-- ---------------------------------------------------------------------------

-- Los comentarios de 0005 describian `subtotal_clp` como bruto menos descuento, que es la
-- definicion que D-039 ha reemplazado. Un comentario equivocado es la primera cosa que lee
-- quien toca la tabla, asi que se corrigen aqui.
comment on column orders.subtotal_clp is
  'Subtotal en CLP enteros segun D-039: suma de las lineas, SIN descontar. El descuento vive en discount_clp.';
comment on column orders.discount_clp is
  'Descuento aplicado en CLP enteros, ya restado del subtotal para obtener el importe a pagar. Nunca procede del cliente.';
comment on column orders.total_clp is
  'Importe a pagar en CLP enteros: subtotal_clp menos discount_clp. Sin propina. Nunca procede del cliente.';
