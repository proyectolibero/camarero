-- 0024 — La identidad del local como dato, y los avisos del comensal (TASK-F4-01, TASK-F1-13).
--
-- CONTEXTO. Dos cosas que el humano pidio y que el esquema no tenía resueltas:
--
--   a) La IDENTIDAD DEL LOCAL. Las columnas `theme_json`, `logo_r2_key` y `cover_r2_key`
--      existen desde la migracion 0002, pero nadie las usaba ni las validaba: `theme_json`
--      aceptaba cualquier json y el borde no distinguia un modelo de otro. La identidad es un
--      DATO del local (ADR-0035), no codigo: cambiarla no puede tocar un despliegue.
--   b) LOS AVISOS DEL COMENSAL. «Llamar al empleado» y «la mesa necesita limpieza» son dos
--      botones que tienen que LLEGAR a la pantalla del personal. No habia donde guardarlos.
--
-- QUE HACE ESTA MIGRACION:
--   1. Valida `theme_json` con un check: solo admite las claves conocidas (modelo, acento) y
--      solo valores del catalogo. Un modelo inventado no entra en la base.
--   2. Expone la identidad con funciones de lectura (`camarero_identidad_de_local`) para que
--      el borde no reimplemente la regla en TypeScript.
--   3. Crea `table_notices`: una llamada viva de cada tipo por mesa (indice unico parcial),
--      caducidad sola y atencion a mano, con RLS por las mismas cerraduras del comensal.
--   4. Deja el ciclo de vida en funciones: `camarero_caducar_avisos` para el cron.
--
-- El invariante de cero ciclos y el de definer endurecido se comprueban en `invariantes.test.ts`:
-- aqui todas las funciones definer apellidan `public.` y fijan `search_path = pg_catalog`.

-- ---------------------------------------------------------------------------
-- 1. La identidad del local: un check, para que un modelo inventado no entre
-- ---------------------------------------------------------------------------

alter table public.locations
  add constraint locations_theme_valido check (
    theme_json is null
    or (
      jsonb_typeof(theme_json) = 'object'
      and theme_json - 'modelo' - 'acento' = '{}'::jsonb
      and (not theme_json ? 'modelo' or theme_json->>'modelo' in
        ('sobrio', 'calido', 'moderno', 'nocturno', 'verde'))
      and (not theme_json ? 'acento' or theme_json->>'acento' ~ '^#[0-9a-fA-F]{6}$')
    )
  );

comment on constraint locations_theme_valido on public.locations is
  'La identidad visual solo admite las claves conocidas (modelo, acento) y un modelo del catalogo. Un acento es un hex de seis cifras. El resto de claves se rechaza: theme_json no es un cajon de sastre.';
comment on column public.locations.theme_json is
  'Identidad visual del local como DATO (ADR-0035): {"modelo": "sobrio|calido|moderno|nocturno|verde", "acento": "#rrggbb"}. Nulo significa modelo por defecto. Cambiarla no toca codigo.';

-- La plataforma tambien puede editar la identidad: la politica `locations_update` de 0010 ya
-- exige org_owner o platform_admin, que es el mismo alcance del alta. No se relaja aqui.

-- ---------------------------------------------------------------------------
-- 2. La identidad como funcion de lectura: el borde no reimplementa la regla
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER a proposito: la lectura de `locations` hereda la visibilidad de quien
-- actua, como en `camarero_estacion_de_plato` (LL-011). Un definer leeria la carta como su
-- dueno y, con FORCE RLS, devolveria cero filas sin que nada fallara: justo el fallo
-- silencioso que la memoria tiene prohibido.
create function camarero_modelo_de_local(p_local uuid) returns text
language sql stable security invoker
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(l.theme_json->>'modelo', ''),
    'sobrio'
  )
  from public.locations l
  where l.id = p_local
$$;

comment on function camarero_modelo_de_local(uuid) is
  'Modelo visual del local. Sin eleccion, el modelo por defecto del sistema: sobrio. La regla vive en la base, no en cada pantalla.';

create function camarero_acento_de_local(p_local uuid) returns text
language sql stable security invoker
set search_path = pg_catalog
as $$
  select nullif(l.theme_json->>'acento', '')
  from public.locations l
  where l.id = p_local
$$;

comment on function camarero_acento_de_local(uuid) is
  'Color de acento propio del local (#rrggbb), o nulo si usa el del modelo. Un valor invalido no puede existir: el check de la columna lo impide.';

-- ---------------------------------------------------------------------------
-- 3. Los avisos del comensal (TASK-F1-13)
-- ---------------------------------------------------------------------------
--
-- Una tabla nueva y no una reutilizacion de `pairing_requests`: un aviso no es una solicitud de
-- acceso ni comparte su maquina de estados (pending/approved/rejected/expired). Meterlo alli
-- habria obligado a ensuciar la ventana de emparejamiento y a ampliar su check, con dos
-- conceptos distintos viviendo en la misma fila. Un aviso tiene su propio ciclo
-- (pendiente -> atendida) y su propia caducidad, y solo necesita la sesion y la mesa.
--
-- El TOPE de una llamada viva de cada tipo por mesa es un indice unico PARCIAL: la base es la
-- cerradura, no el boton. Un intento de inundar el local falla con conflicto, no crea fila.

create table table_notices (
  id uuid primary key default camarero_uuid_v7(),
  session_id uuid not null references table_sessions (id) on delete cascade,
  table_id uuid not null references tables (id) on delete restrict,
  kind text not null,
  state text not null default 'pendiente',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attended_at timestamptz,
  attended_by uuid references staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_notices_kind_valido check (kind in ('llamar_empleado', 'necesita_limpieza')),
  constraint table_notices_state_valido check (state in ('pendiente', 'atendida')),
  constraint table_notices_atencion_coherente check (
    (state = 'atendida') = (attended_at is not null)
  ),
  constraint table_notices_caducidad_posterior check (expires_at > requested_at)
);

comment on table table_notices is
  'Avisos del comensal al local: llamar al empleado y avisar de que la mesa necesita limpieza. Llegan a la pantalla del personal y caducan solos. No guardan ningun dato del comensal: solo la sesion y la mesa.';
comment on column table_notices.kind is
  'llamar_empleado o necesita_limpieza. Dos botones distintos del comensal.';
comment on column table_notices.state is
  'pendiente (viva, en la lista del personal) o atendida (alguien la atendio y desaparece).';
comment on column table_notices.expires_at is
  'Cuando caduca sola si nadie la atiende. Evita acumular basura de servicios anteriores.';
comment on column table_notices.attended_by is
  'Empleado que la marco atendida. on delete set null para no perder el aviso aunque se borre al empleado.';

create index table_notices_table_idx on table_notices (table_id, state);
create index table_notices_session_idx on table_notices (session_id);
create index table_notices_attended_by_idx on table_notices (attended_by);
-- El tope: como maximo UNA pendiente y viva de cada tipo por mesa. El indice es PARCIAL sobre
-- lo vivo, de modo que un aviso atendido o caducado no bloquea el siguiente.
create unique index table_notices_una_viva_por_tipo
  on table_notices (table_id, kind)
  where state = 'pendiente';

create trigger table_notices_set_updated_at
  before update on table_notices
  for each row execute function camarero_set_updated_at();

-- Toda tabla nueva lleva ENABLE y FORCE ROW LEVEL SECURITY. Sin esto, las politicas no se
-- aplican y la cerradura es decorativa: se comprobo en esta misma migracion.
alter table public.table_notices enable row level security;
alter table public.table_notices force row level security;

-- ---------------------------------------------------------------------------
-- 4. Las cerraduras de los avisos
-- ---------------------------------------------------------------------------
--
-- Mismo patron que las solicitudes de emparejamiento: el alcance de LECTURA y el de ESCRITURA
-- coinciden. El comensal solo ve y toca los avisos de SU sesion; el personal, los de su local
-- y el dueno, los de su organizacion. Ninguna politica lee su propia tabla (cero ciclos).

-- El comensal ve los avisos de su propia sesion; el personal, los de su local.
create policy table_notices_select on public.table_notices for select
  using (
    public.es_platform_admin()
    or (public.es_comensal() and session_id = public.sesion_actual())
    or public.en_mi_local_comensal(public.local_de_la_sesion(session_id))
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  );

comment on policy table_notices_select on public.table_notices is
  'El comensal ve los avisos de su sesion; el personal, los de su local; el dueno, los de su organizacion. La RLS acota: una mesa de otro local no se ve.';

-- El comensal CREA un aviso SOLO para su propia sesion, mesa y localidad. El check de la
-- columna ya valida el tipo; aqui se ata la fila al contexto, como en la comanda. Ademas la
-- mesa tiene que ser LA MESA DE ESA SESION: sin eso, un comensal podria insertar con su sesion
-- y la mesa de otro local, o al reves, y las politicas de lectura lo dejarian fuera de sitio.
create policy table_notices_insert on public.table_notices for insert
  with check (
    public.es_comensal()
    and session_id = public.sesion_actual()
    and table_id = public.mesa_en_contexto()
    and public.local_de_la_sesion(session_id) = public.local_actual()
    and state = 'pendiente'
    and attended_at is null
    and attended_by is null
  );

comment on policy table_notices_insert on public.table_notices is
  'El comensal solo puede crear un aviso pendiente para SU sesion, SU mesa y SU localidad: la sesion y la mesa van atadas. No puede crear uno ya atendido ni para otra mesa. El tope de una viva por tipo lo impone el indice unico parcial.';

-- El personal (o el dueno) marca atendido un aviso de su alcance. El comensal NO puede
-- atenderse su propio aviso ni cerrarlo: eso es acto del local.
create policy table_notices_atender on public.table_notices for update
  using (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  )
  with check (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  );

comment on policy table_notices_atender on public.table_notices is
  'Quien ve un aviso de su alcance puede marcarlo atendido: plataforma, dueno de la organizacion y personal del local. El comensal no puede tocarlo.';

-- ---------------------------------------------------------------------------
-- 5. El ciclo de vida: atender y caducar
-- ---------------------------------------------------------------------------

-- Atender un aviso por su id, con rastro en la auditoria. Funcion de INVOCADOR: la RLS del
-- empleado sigue mandando; si el aviso no es de su alcance, no lo ve y devuelve sin_atender.
create function camarero_atender_aviso(p_aviso uuid) returns text
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_filas integer;
  v_sesion uuid;
  v_local uuid;
begin
  update public.table_notices
     set state = 'atendida', attended_at = now(), attended_by = public.staff_actual()
   where id = p_aviso and state = 'pendiente';
  get diagnostics v_filas = row_count;

  if v_filas <> 1 then
    -- O no existe, o es de otro local, o ya estaba atendida. La RLS no distingue; la pantalla
    -- muestra un aviso y el personal vuelve a mirar la lista.
    return 'no_atendible';
  end if;

  select n.session_id, public.local_de_la_sesion(n.session_id)
    into v_sesion, v_local
    from public.table_notices n where n.id = p_aviso;

  insert into public.audit_log (org_id, actor_staff_id, action, entity, entity_id, after_json)
  values (
    public.org_del_staff(),
    public.staff_actual(),
    'table_notice.attended',
    'table_notice',
    p_aviso,
    jsonb_build_object('session_id', v_sesion, 'location_id', v_local)
  );

  return 'ok';
end;
$$;

comment on function camarero_atender_aviso(uuid) is
  'Marca atendido un aviso de pendiente y deja rastro. Funcion de invocador: la RLS decide si el aviso es del alcance del empleado. Devuelve ok o no_atendible.';

-- La caducidad la ejecuta el cron del borde con contexto de plataforma. `p_ahora` permite
-- DEMOSTRAR el paso del tiempo en las pruebas, como en el cierre por inactividad.
create function camarero_caducar_avisos(p_ahora timestamptz default now())
returns integer
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_marcadas integer;
begin
  update public.table_notices
     set state = 'atendida', attended_at = now()
   where state = 'pendiente' and expires_at <= p_ahora;
  get diagnostics v_marcadas = row_count;
  return v_marcadas;
end;
$$;

comment on function camarero_caducar_avisos(timestamptz) is
  'Caduca los avisos pendientes cuya hora de caducidad ya paso. Los marca atendidos para que desaparezcan de la lista sin acusar a nadie; el rastro queda en la fila. El parametro p_ahora permite demostrar el paso del tiempo.';
