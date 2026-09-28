-- 0013 — El cierre de importes: la cuenta se cierra cuando el personal acepta.
--
-- CONTEXTO. Tras 0012, el precio de cada linea sale de la carta. Pero los totales de la
-- comanda seguian viniendo de quien la insertaba: un comensal podia crear una comanda con
-- discount_clp igual al bruto y total_clp a cero. El agujero estaba en que el comensal no
-- puede (ni debe) actualizar su comanda, asi que un disparador de UPDATE sobre orders nunca
-- se disparaba para el. Se probo el diseno de ADR-0008 y no funciona; ADR-0014 (rol con
-- BYPASSRLS) abria demasiado; la via elegida es esta.
--
-- DISENO (opcion 1, acordada). El cierre es un EFECTO del cambio de estado que hace el
-- personal, no una llamada aparte que alguien pueda olvidar:
--
--   1. Toda comanda nace 'pendiente' y con los importes a cero. Lo fija la base, no el
--      cliente (CONTRACT-estados-comanda, regla 3).
--   2. Cuando el personal la pasa a 'aceptada', cada linea se lleva a su valor final
--      (precio + modificadores) * cantidad, y la cuenta se cierra sumando las lineas.
--   3. Despues de aceptada, no se anaden lineas ni modificadores: la comanda es un
--      documento cerrado.
--
-- El personal SI puede escribir la comanda (puede_operar), asi que el disparador de cierre
-- corre con su contexto y ve las lineas. El comensal no puede, asi que no puede cerrar sus
-- propios importes. No hace falta ningun rol con BYPASSRLS.
--
-- SEGURIDAD. Todas las funciones son SECURITY INVOKER, por la misma razon que en 0012: la
-- lectura de la comanda y de sus lineas debe heredar la visibilidad de quien actua. Con
-- definer, el dueno sin privilegios no veria nada sin contexto y el dueno superusuario
-- abriria fuga entre organizaciones (LL-011).

-- ---------------------------------------------------------------------------
-- 1. La comanda nace pendiente y sin importes
-- ---------------------------------------------------------------------------

create function camarero_abrir_comanda() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  -- El estado de entrada lo decide la base, no el cliente: asi no se puede crear una
  -- comanda ya 'aceptada' para saltarse el cierre de importes.
  new.status := 'pendiente';
  -- Los importes son derivados: valen cero hasta que el cierre los calcula.
  new.subtotal_clp := 0;
  new.discount_clp := 0;
  new.total_clp := 0;
  return new;
end;
$$;

comment on function camarero_abrir_comanda() is
  'Disparador BEFORE INSERT de orders: fuerza el estado inicial pendiente y los importes a cero. Ignora lo que envie el cliente, que no puede fijar ni el estado ni el dinero.';

create trigger orders_abrir
  before insert on orders
  for each row execute function camarero_abrir_comanda();

-- ---------------------------------------------------------------------------
-- 2. El cierre: al aceptar, las lineas a su valor final y la cuenta sumada
-- ---------------------------------------------------------------------------

create function camarero_cerrar_importes_de_comanda() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_subtotal integer;
begin
  -- Solo se cierra al entrar en 'aceptada' desde otro estado. Si ya estaba aceptada (por
  -- ejemplo, un cambio posterior que solo ajusta el descuento), no se pisa nada.
  if new.status <> 'aceptada' or old.status = 'aceptada' then
    return new;
  end if;

  -- Forma 1: cada linea se lleva a (precio + suma de deltas) * cantidad.
  update public.order_items oi
     set line_total_clp = (
           oi.unit_price_clp
           + coalesce((
               select sum(m.price_delta_clp)
                 from public.order_item_modifiers m
                where m.order_item_id = oi.id
             ), 0)
         ) * oi.qty
   where oi.order_id = new.id;

  -- La cuenta es la suma de las lineas ya cerradas.
  select coalesce(sum(oi.line_total_clp), 0)
    into v_subtotal
    from public.order_items oi
   where oi.order_id = new.id;

  new.subtotal_clp := v_subtotal;
  -- El descuento nunca procede de quien pide: al cerrar se descarta. Un descuento legitimo
  -- se aplica despues, a la cuenta (bill_requests) o por personal autorizado.
  new.discount_clp := 0;
  new.total_clp := v_subtotal;
  return new;
end;
$$;

comment on function camarero_cerrar_importes_de_comanda() is
  'Disparador BEFORE UPDATE de orders: al pasar la comanda a aceptada, recalcula cada linea (precio mas modificadores por cantidad) y cierra los totales de la comanda. Descarta cualquier descuento o total enviado por quien pide.';

create trigger orders_cerrar_importes
  before update on orders
  for each row execute function camarero_cerrar_importes_de_comanda();

-- ---------------------------------------------------------------------------
-- 3. Guardia: la comanda es un documento cerrado en cuanto se acepta
-- ---------------------------------------------------------------------------

create function camarero_exigir_comanda_pendiente(p_order_id uuid) returns void
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_estado text;
begin
  select o.status into v_estado from public.orders o where o.id = p_order_id;

  if v_estado is null then
    raise exception 'La comanda indicada no existe o no es visible'
      using errcode = 'check_violation';
  end if;

  if v_estado <> 'pendiente' then
    raise exception 'Solo se admiten lineas o modificadores en una comanda pendiente (estado actual: %)',
      v_estado
      using errcode = 'check_violation';
  end if;
end;
$$;

comment on function camarero_exigir_comanda_pendiente(uuid) is
  'Comprueba que una comanda existe, es visible para quien actua y sigue pendiente. Se usa para no admitir lineas ni modificadores en una comanda ya aceptada.';

create function camarero_guardar_linea() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  perform public.camarero_exigir_comanda_pendiente(new.order_id);
  return new;
end;
$$;

comment on function camarero_guardar_linea() is
  'Disparador BEFORE INSERT de order_items: solo deja anadir una linea a una comanda pendiente.';

create trigger order_items_exigir_comanda_pendiente
  before insert on order_items
  for each row execute function camarero_guardar_linea();

create function camarero_guardar_modificador() returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  v_order_id uuid;
begin
  select oi.order_id into v_order_id
    from public.order_items oi
   where oi.id = new.order_item_id;

  if v_order_id is null then
    raise exception 'El modificador apunta a una linea que no existe o no es visible'
      using errcode = 'check_violation';
  end if;

  perform public.camarero_exigir_comanda_pendiente(v_order_id);
  return new;
end;
$$;

comment on function camarero_guardar_modificador() is
  'Disparador BEFORE INSERT de order_item_modifiers: solo deja anadir un modificador a una linea de una comanda pendiente.';

create trigger order_item_modifiers_exigir_comanda_pendiente
  before insert on order_item_modifiers
  for each row execute function camarero_guardar_modificador();
