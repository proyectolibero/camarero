-- 0014 — Correcciones de alcance: el encargado de organizacion y el cobro imputado.
--
-- CONTEXTO. Dos correcciones que se verificaron como necesarias al descartar los intentos
-- anteriores y que nunca llegaron a main:
--
--  1. Un encargado (location_manager) SIN local asignado no alcanzaba su organizacion: no
--     veia ningun local, ni la carta, ni las comandas. El encargado es de la organizacion,
--     no de un local concreto. Pero un camarero sin local NO debe ver nada: la diferencia
--     es el rol, no tener o no un local.
--  2. Un cobro se podia registrar a nombre de OTRO empleado: la politica de checkouts no
--     comprobaba que settled_by_staff_id fuera quien lo registra.
--
-- CUIDADO CON EL CICLO. El intento anterior resolvio el punto 1 con una politica que leia
-- table_sessions y abrio el ciclo locations -> table_sessions -> locations. Aqui se resuelve
-- leyendo SOLO de `staff` (la organizacion del encargado sale de su fila de staff), sin
-- tocar table_sessions. El invariante de ciclos lo comprueba.

-- ---------------------------------------------------------------------------
-- 1. El encargado de una organizacion
-- ---------------------------------------------------------------------------

create function es_encargado_de_org(p_org uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_location_manager()
     and p_org is not null
     and p_org = public.org_del_staff()
$$;

comment on function es_encargado_de_org(uuid) is
  'Verdadero si quien actua es encargado y la organizacion indicada es la suya. La organizacion se deriva de su fila de staff (org_del_staff), nunca de table_sessions, para no abrir el ciclo locations -> table_sessions -> locations.';

-- ---------------------------------------------------------------------------
-- 2. El encargado sin local ve los locales de su organizacion
-- ---------------------------------------------------------------------------

-- Se usa la COLUMNA org_id de la propia fila, no org_del_local(id): leer locations desde
-- una politica de locations seria recursion. Y no se toca table_sessions.
drop policy locations_select on public.locations;
create policy locations_select on public.locations for select
  using (
    public.es_platform_admin()
    or (public.es_org_owner() and org_id = public.org_actual())
    or public.es_encargado_de_org(org_id)
    or public.en_mi_local(id)
    or public.en_mi_local_comensal(id)
  );

-- ---------------------------------------------------------------------------
-- 3. La carta: el encargado de la organizacion tambien la ve
-- ---------------------------------------------------------------------------

create or replace function ve_local_personal(p_local uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(public.org_del_local(p_local))
      or public.en_mi_local(p_local)
      or public.es_encargado_de_org(public.org_del_local(p_local))
$$;

comment on function ve_local_personal(uuid) is
  'Local visible para el personal de gestion: plataforma, dueno, empleado del local y encargado de la organizacion. No se usa para la propia tabla locations.';

-- ---------------------------------------------------------------------------
-- 4. Las comandas: el encargado de la organizacion tambien las ve
-- ---------------------------------------------------------------------------

create or replace function ve_orden(p_org uuid, p_local uuid, p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(p_org)
      or public.en_mi_local(p_local)
      or public.en_mi_sesion(p_sesion)
      or public.es_encargado_de_org(p_org)
$$;

comment on function ve_orden(uuid, uuid, uuid) is
  'Comanda visible: plataforma, dueno de la organizacion, personal del local, encargado de la organizacion o el comensal de esa sesion.';

-- ---------------------------------------------------------------------------
-- 5. El cobro se imputa a quien lo registra
-- ---------------------------------------------------------------------------

-- La politica vuelve a comprobar la organizacion y el local de la sesion (por eso se
-- recrea entera, no se anade un AND suelto) y, ademas, exige que el responsable del cobro
-- sea el empleado que lo registra. Un cobro siempre tiene un responsable identificable.
drop policy checkouts_insert on public.checkouts;
create policy checkouts_insert on public.checkouts for insert
  with check (
    settled_by_staff_id = public.staff_actual()
    and (
      public.es_platform_admin()
      or public.en_mi_org(public.org_de_la_sesion(session_id))
      or (public.es_cobrador() and public.en_mi_local(public.local_de_la_sesion(session_id)))
    )
  );
