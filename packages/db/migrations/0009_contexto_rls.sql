-- 0009 — Funciones de contexto para las politicas RLS.
--
-- Centralizan la lectura de `current_setting('app.*', true)` con su `nullif('')` para no
-- repetir esa expresion en cada politica. Son STABLE (el contexto no cambia dentro de una
-- consulta) y SECURITY DEFINER con search_path fijado a pg_catalog, de modo que su
-- comportamiento no depende del search_path del llamante (endurecimiento clasico contra
-- secuestro de busqueda de esquema).
--
-- IMPORTANTE: el propietario de estas funciones es camarero_owner, que NO es superusuario
-- ni tiene BYPASSRLS, y las tablas llevan FORCE ROW LEVEL SECURITY. Por tanto, cuando una
-- funcion lee una tabla, esa lectura queda sujeta a las politicas igual que cualquier otra
-- consulta. No son un atajo para saltarse la RLS; solo encapsulan la logica de alcance.
--
-- Regla de diseno para no provocar recursion infinita: una politica de la tabla X no puede
-- consultar X (ni directa ni transitivamente). Por eso las funciones de alcance reciben el
-- valor de la fila como parametro, en lugar de releer la tabla a la que pertenecen.

-- ---------------------------------------------------------------------------
-- Contexto crudo (app.*)
-- ---------------------------------------------------------------------------

create function org_actual() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

create function staff_actual() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.staff_id', true), '')::uuid $$;

create function rol_actual() returns text
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.role', true), '') $$;

create function sesion_actual() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.session_id', true), '')::uuid $$;

create function local_actual() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.location_id', true), '')::uuid $$;

create function device_actual() returns text
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.device_alias', true), '') $$;

comment on function rol_actual() is
  'Rol del actor: platform_admin, org_owner, location_manager, server, kitchen o no_pin. Nulo si no hay actor (comensal anonimo o contexto vacio).';

-- ---------------------------------------------------------------------------
-- Predicados de rol
-- ---------------------------------------------------------------------------

create function es_platform_admin() returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.rol_actual() = 'platform_admin' $$;

create function es_org_owner() returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.rol_actual() = 'org_owner' $$;

create function es_location_manager() returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.rol_actual() = 'location_manager' $$;

-- Rol de local sin permiso de gestion: camarero, cocina o tablet compartida.
create function es_staff_de_local() returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.rol_actual() in ('location_manager', 'server', 'kitchen', 'no_pin') $$;

-- Roles autorizados a registrar cobros en el TPV (nunca cocina ni no_pin).
create function es_cobrador() returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.rol_actual() in ('location_manager', 'server') $$;

-- El comensal anonimo no tiene rol y se identifica por su sesion de mesa.
create function es_comensal() returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.rol_actual() is null and public.sesion_actual() is not null $$;

-- ---------------------------------------------------------------------------
-- Lecturas derivadas (propietario de la fila -> organizacion o local)
-- ---------------------------------------------------------------------------

create function local_del_staff() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.location_id from public.staff s where s.id = public.staff_actual() $$;

create function org_del_staff() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.org_id from public.staff s where s.id = public.staff_actual() $$;

create function org_del_staff_de(p_staff uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.org_id from public.staff s where s.id = p_staff $$;

create function local_de_sesion() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.location_id from public.table_sessions s where s.id = public.sesion_actual() $$;

create function org_de_sesion() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.org_id from public.table_sessions s where s.id = public.sesion_actual() $$;

create function local_de_la_sesion(p_sesion uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.location_id from public.table_sessions s where s.id = p_sesion $$;

create function org_de_la_sesion(p_sesion uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select s.org_id from public.table_sessions s where s.id = p_sesion $$;

create function org_del_local(p_local uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select l.org_id from public.locations l where l.id = p_local $$;

create function local_de_mesa(p_mesa uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select t.location_id from public.tables t where t.id = p_mesa $$;

create function local_de_item(p_item uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select i.location_id from public.menu_items i where i.id = p_item $$;

create function local_de_grupo(p_grupo uuid) returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select g.location_id from public.modifier_groups g where g.id = p_grupo $$;

-- ---------------------------------------------------------------------------
-- Predicados de alcance
-- ---------------------------------------------------------------------------

create function en_mi_org(p_org uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.es_org_owner() and p_org is not null and p_org = public.org_actual() $$;

-- El local del personal se deriva de la fila de staff (app.staff_id), nunca de
-- app.location_id: asi el contexto no puede apuntar a un local ajeno. Si el borde fija
-- app.location_id, solo puede acotar dentro de lo ya permitido.
create function en_mi_local(p_local uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_staff_de_local()
     and p_local is not null
     and p_local = public.local_del_staff()
     and (public.local_actual() is null or public.local_actual() = p_local)
$$;

create function en_mi_sesion(p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.es_comensal() and p_sesion is not null and p_sesion = public.sesion_actual() $$;

create function en_mi_local_comensal(p_local uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$ select public.es_comensal() and p_local is not null and p_local = public.local_de_sesion() $$;

-- Local visible para el personal y el dueno (incluye plataforma). No se usa para la
-- propia tabla `locations`, que resuelve su organizacion por columna directa.
create function ve_local_personal(p_local uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(public.org_del_local(p_local))
      or public.en_mi_local(p_local)
$$;

create function ve_orden(p_org uuid, p_local uuid, p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(p_org)
      or public.en_mi_local(p_local)
      or public.en_mi_sesion(p_sesion)
$$;

-- Escritura de configuracion del local: plataforma, dueno o encargado del local.
create function puede_gestionar(p_local uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(public.org_del_local(p_local))
      or (public.es_location_manager() and public.en_mi_local(p_local))
$$;

-- Escritura operativa: cualquier empleado del local (camarero, cocina, encargado...).
create function puede_operar(p_local uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(public.org_del_local(p_local))
      or public.en_mi_local(p_local)
$$;

-- Alta de una comanda: el comensal solo en su sesion y con la org/local de esa sesion;
-- el personal, en un local que opera.
create function puede_crear_orden(p_org uuid, p_local uuid, p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_platform_admin()
      or public.en_mi_org(p_org)
      or public.en_mi_local(p_local)
      or (
        public.es_comensal()
        and p_sesion = public.sesion_actual()
        and p_org = public.org_de_sesion()
        and p_local = public.local_de_sesion()
      )
$$;

-- La mesa sobre la que se actua es la de la propia sesion del comensal.
create function tabla_de_mi_sesion(p_mesa uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select public.es_comensal()
     and exists (
       select 1 from public.table_sessions s
       where s.id = public.sesion_actual() and s.table_id = p_mesa
     )
$$;
