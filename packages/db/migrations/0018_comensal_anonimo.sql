-- 0018 — El comensal anonimo: dos cerraduras minimas y la aprobacion como barrera.
--
-- El camino del comensal no existia (LL-022): no podia resolver el codigo de su mesa ni
-- crear su sesion, y la aprobacion humana del emparejamiento no era una barrera de base,
-- solo un acuerdo de pantalla. Esta migracion lo cierra con el mismo patron que 0015 uso
-- para el personal: dos cerraduras minimas que leen SOLO el contexto, sin consultar otra
-- tabla, de modo que no cierran ningun ciclo de politicas (ADR-0031).
--
--   - Cerradura 1 (`tables_select_por_codigo`): el comensal ve SOLO la mesa cuyo `code`
--     viene en `app.table_code`.
--   - Cerradura 2 (`table_sessions_insert_comensal`): el comensal crea SOLO la sesion de esa
--     mesa, en estado `pairing`, y solo mientras no tenga sesion.
--
-- AGUJERO QUE SE CIERRA: la fila de la sesion trae `location_id`. Si se aceptara de la fila,
-- con la mesa correcta y la localidad de OTRO local se veria la carta ajena. Por eso la
-- localidad NO se acepta: el disparador la deriva de la mesa y la organizacion de su local.
--
-- APROBACION COMO BARRERA: `puede_crear_orden` exigia sesion pero no miraba su estado. Ahora
-- la rama del comensal exige `state = 'active'`, que solo alcanza quien aprueba desde el
-- panel. Y una solicitud caducada (`pairing_expires_at` vencido) no se puede aprobar.
--
-- NOTA SOBRE FORCE RLS: el disparador es SECURITY DEFINER del propietario, pero las tablas
-- llevan FORCE, asi que su lectura de `locations` tambien pasa por las politicas. Para que
-- pueda derivar la organizacion se anade una visibilidad minima y por contexto de la
-- localidad (`locations_select_por_contexto`, `id = app.location_id`), que el borde fija
-- desde la fila de la mesa. Es contexto puro: no lee tablas y no cierra ningun ciclo, y no
-- sirve para ver la carta ajena porque la carta del comensal se resuelve por la SESION, no
-- por `app.location_id`.

-- ---------------------------------------------------------------------------
-- Contexto del comensal anonimo
-- ---------------------------------------------------------------------------

create function codigo_de_mesa() returns text
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.table_code', true), '') $$;

comment on function codigo_de_mesa() is
  'Codigo de mesa que fija el borde al abrir /t/<codigo>. Nulo fuera de ese camino. Solo lee configuracion de sesion: no toca ninguna tabla.';

create function mesa_en_contexto() returns uuid
language sql stable security definer
set search_path = pg_catalog
as $$ select nullif(current_setting('app.table_id', true), '')::uuid $$;

comment on function mesa_en_contexto() is
  'Identificador de la mesa que el borde resolvio al leer la fila del codigo. Solo lee configuracion de sesion: no toca ninguna tabla.';

create function sesion_aprobada(p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.table_sessions s
    where s.id = p_sesion and s.state = 'active'
  )
$$;

comment on function sesion_aprobada(uuid) is
  'Verdadero solo si la sesion esta aprobada (state = active). Es la barrera de base de la aprobacion humana: sin aprobacion no se crea una comanda.';

create function solicitud_vigente(p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.table_sessions s
    where s.id = p_sesion
      and (s.pairing_expires_at is null or s.pairing_expires_at > now())
  )
$$;

comment on function solicitud_vigente(uuid) is
  'Verdadero si la ventana de emparejamiento de la sesion no ha caducado. Una solicitud caducada no puede aprobarse.';

-- ---------------------------------------------------------------------------
-- Cerradura 1: resolver la mesa por su codigo (solo contexto)
-- ---------------------------------------------------------------------------

create policy tables_select_por_codigo on public.tables for select
  using (public.codigo_de_mesa() is not null and code = public.codigo_de_mesa());

comment on policy tables_select_por_codigo on public.tables is
  'Cerradura minima del comensal: deja ver SOLO la mesa cuyo code viene en app.table_code. Lee solo el contexto, sin consultar otra tabla, de modo que no cierra ningun ciclo.';

-- ---------------------------------------------------------------------------
-- Visibilidad minima de la localidad para que el disparador derive la org
-- ---------------------------------------------------------------------------

create policy locations_select_por_contexto on public.locations for select
  using (
    public.rol_actual() is null
    and public.sesion_actual() is null
    and public.codigo_de_mesa() is not null
    and id = public.local_actual()
  );

comment on policy locations_select_por_contexto on public.locations is
  'Deja leer SOLO el local que el borde fijo en app.location_id, mientras el comensal aun no tiene sesion. Es lo que permite al disparador derivar la organizacion de la mesa. Contexto puro: no lee tablas ni cierra ciclos. No da acceso a la carta ajena: la carta del comensal se resuelve por la sesion, no por app.location_id.';

-- ---------------------------------------------------------------------------
-- Cerradura 2: abrir la sesion de la mesa del contexto
-- ---------------------------------------------------------------------------

create policy table_sessions_insert_comensal on public.table_sessions for insert
  with check (
    public.rol_actual() is null
    and public.sesion_actual() is null
    and state = 'pairing'
    and table_id = public.mesa_en_contexto()
    and location_id = public.local_actual()
  );

comment on policy table_sessions_insert_comensal on public.table_sessions is
  'Cerradura minima del comensal: crea SOLO la sesion de la mesa del contexto (app.table_id) y su localidad (app.location_id), en estado pairing y sin sesion previa. La localidad se comprueba aqui y ademas el disparador la deriva de la mesa: no se acepta de la fila.';

-- ---------------------------------------------------------------------------
-- El disparador deriva la localidad de la mesa y la organizacion de su local
-- ---------------------------------------------------------------------------

create or replace function camarero_completar_org_sesion()
returns trigger
language plpgsql
security definer
-- Solo pg_catalog: nada de `public` en la ruta de busqueda (RISK-017).
set search_path = pg_catalog
as $$
begin
  -- Comensal anonimo desde el QR: la mesa manda. Ni la localidad ni la organizacion se
  -- aceptan de la fila; se derivan de la mesa y de su local. Bajo FORCE RLS solo puede leer
  -- la mesa porque la cerradura 1 lo permite, y el local porque el borde fijo app.location_id.
  if public.rol_actual() is null and public.codigo_de_mesa() is not null then
    select t.location_id into new.location_id from public.tables t where t.id = new.table_id;
    if new.location_id is null then
      raise exception 'La mesa % no es visible desde el codigo de contexto', new.table_id;
    end if;
    new.org_id := null;
  end if;
  if new.org_id is null then
    -- Referencia CUALIFICADA. Con `public.` delante, una tabla temporal homonima ya no
    -- puede interceptar la lectura, porque la resolucion no pasa por pg_temp.
    select l.org_id into new.org_id from public.locations l where l.id = new.location_id;
  end if;
  if new.org_id is null then
    raise exception 'No se pudo determinar org_id para la sesion %', new.id;
  end if;
  return new;
end;
$$;

comment on function camarero_completar_org_sesion() is
  'Trigger BEFORE INSERT: deriva la localidad de la mesa y la organizacion del local. Para el comensal anonimo ninguna de las dos se acepta de la fila. search_path solo pg_catalog y referencias cualificadas: sin esto, una tabla temporal puede secuestrar la lectura (RISK-017).';

-- ---------------------------------------------------------------------------
-- La aprobacion deja de ser un acuerdo de pantalla: es barrera de base
-- ---------------------------------------------------------------------------

create or replace function puede_crear_orden(p_org uuid, p_local uuid, p_sesion uuid)
returns boolean
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
        and public.sesion_aprobada(p_sesion)
      )
$$;

comment on function puede_crear_orden(uuid, uuid, uuid) is
  'Alta de una comanda: el comensal solo en su sesion APROBADA (state = active) y con la org/local de esa sesion; el personal, en un local que opera. La aprobacion humana es barrera de base, no acuerdo de pantalla (LL-022).';

-- La solicitud del comensal nace PENDIENTE: no puede colarse una ya aprobada.
drop policy pairing_requests_insert on public.pairing_requests;
create policy pairing_requests_insert on public.pairing_requests for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or (
      public.en_mi_sesion(session_id)
      and public.tabla_de_mi_sesion(table_id)
      and state = 'pending'
      and decided_at is null
      and decided_by is null
    )
  );

comment on policy pairing_requests_insert on public.pairing_requests is
  'El comensal crea su solicitud SOLO en estado pending y sin decision: no puede insertarla ya aprobada para saltarse la aprobacion humana.';

-- Una solicitud caducada no se puede aprobar (ni rechazar).
drop policy pairing_requests_update on public.pairing_requests;
create policy pairing_requests_update on public.pairing_requests for update
  using (
    (public.es_platform_admin() or public.en_mi_local(public.local_de_la_sesion(session_id)))
    and public.solicitud_vigente(session_id)
  )
  with check (
    (public.es_platform_admin() or public.en_mi_local(public.local_de_la_sesion(session_id)))
    and public.solicitud_vigente(session_id)
  );

comment on policy pairing_requests_update on public.pairing_requests is
  'Solo decide el personal del local (o la plataforma) y solo mientras la ventana de emparejamiento de la sesion sigue viva. Una solicitud caducada no puede aprobarse.';
