-- 0022 — Cerrar la mesa: la sesion que nunca se cerraba (TASK-F1-10, ADR-0031, CONTRACT-protocolo-mesa).
--
-- CONTEXTO. El estado `closed` estaba declarado en el `check` de 0005 y no lo escribia nadie:
-- no habia cierre por inactividad ni cierre a mano, de modo que una mesa emparejada una vez se
-- quedaba ocupada para siempre. La sala empezaba a mentir desde el segundo servicio y el
-- identificador de sesion —que ADR-0031 declara la credencial del comensal, y caduca— no
-- caducaba en la base, solo la cookie.
--
-- QUE HACE ESTA MIGRACION:
--   1. Fija la SEÑAL DE ACTIVIDAD en una columna propia (`last_activity_at`), que el comensal
--      toca en cada interaccion. `table_devices.last_seen` existe en el esquema, pero nadie lo
--      escribia porque el comensal ni siquiera crea dispositivos: la sesion es un token al
--      portador, no un dispositivo identificado. La señal real y honesta es la actividad de la
--      propia sesion.
--   2. Fija la VIDA DE LA SESION en una sola funcion (`camarero_vida_de_sesion`, 4 h), hermana
--      de `camarero_ventana_de_emparejamiento` (10 min), para que contrato y codigo no se
--      separen.
--   3. Anade el CIERRE A MANO (`camarero_cerrar_sesion`): deja `closed_at`, `closed_by` y una
--      fila en `audit_log`. Cerrar deja rastro: quien y cuando.
--   4. Anade el CIERRE POR INACTIVIDAD (`camarero_cerrar_sesiones_inactivas`), que el cron del
--      borde llama sin que nadie mire.
--   5. Deja que el comensal TOCAR su actividad sin poder cambiar estado, mesa ni localidad.
--
-- Una mesa que se cierra y se vuelve a abrir empieza limpia: el comensal crea una sesion
-- NUEVA (pairing + aprobacion). Las comandas del servicio anterior quedan fuera del KDS y de
-- la sala porque ambos excluyen las sesiones cerradas.

-- ---------------------------------------------------------------------------
-- 1. La señal de actividad y el rastro del cierre
-- ---------------------------------------------------------------------------

alter table public.table_sessions
  add column last_activity_at timestamptz not null default now(),
  add column closed_by uuid references public.staff (id) on delete set null;

comment on column public.table_sessions.last_activity_at is
  'Ultima actividad de la sesion. El comensal la toca al abrir la carta, pedir, enviar o ver sus pedidos; el personal, al aprobar o cerrar. Es la señal del cierre por inactividad (4 h).';
comment on column public.table_sessions.closed_by is
  'Empleado que cerro la sesion a mano. Nulo si sigue abierta o si la cerro el paso del tiempo.';

-- Busca la sesion abierta de una mesa por orden de apertura; el indice acota a las abiertas.
create index table_sessions_abiertas_actividad_idx
  on public.table_sessions (last_activity_at)
  where state not in ('closed', 'voided');

-- ---------------------------------------------------------------------------
-- 2. La vida de la sesion: una sola fuente de verdad
-- ---------------------------------------------------------------------------

create function camarero_vida_de_sesion() returns interval
language sql immutable
as $$ select interval '4 hours' $$;

comment on function camarero_vida_de_sesion() is
  'Vida de la sesion sin actividad: cuatro horas (CONTRACT-protocolo-mesa). Es un plazo DISTINTO del de la ventana de emparejamiento (diez minutos).';

-- ---------------------------------------------------------------------------
-- 3. El comensal toca su actividad sin poder cambiar nada mas
-- ---------------------------------------------------------------------------
--
-- La politica de renovacion (0019) solo deja tocar una sesion en `pairing`. Una sesion ya
-- aprobada no cambia de estado salvo por el personal, pero SI tiene que registrar actividad.
-- El `with check` de esta politica congela estado, mesa y localidad: lo unico que el comensal
-- puede escribir es `last_activity_at` (y `updated_at`, que mueve el disparador).
create policy table_sessions_actividad_comensal on public.table_sessions for update
  using (
    public.es_comensal()
    and id = public.sesion_actual()
    and state = 'active'
  )
  with check (
    public.es_comensal()
    and id = public.sesion_actual()
    and state = 'active'
    and table_id = public.mesa_en_contexto()
    and location_id = public.local_actual()
  );

comment on policy table_sessions_actividad_comensal on public.table_sessions is
  'El comensal marca actividad en su propia sesion activa. El with check le impide cambiar estado, mesa o localidad: solo puede tocar last_activity_at.';

-- Las politicas permisivas de UPDATE se combinan con OR, y el WITH CHECK de una puede admitir
-- una fila que el USING de OTRA hizo visible. Sin este disparador, un comensal con la sesion en
-- `pairing` podria escribir `state = 'active'` y aprobarse la mesa solo: el WITH CHECK de esta
-- politica (state = active) lo admitiria aunque el USING de la de renovacion exigiera pairing.
-- El disparador comprueba el cambio REAL, que es lo que la RLS no puede comparar.
create function camarero_comensal_no_escala_sesion() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if public.es_comensal() then
    if new.state is distinct from old.state
      or new.table_id is distinct from old.table_id
      or new.location_id is distinct from old.location_id
      or new.org_id is distinct from old.org_id then
      raise exception 'El comensal no puede cambiar el estado ni el alcance de su sesion'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

comment on function camarero_comensal_no_escala_sesion() is
  'Disparador BEFORE UPDATE de table_sessions: impide que un comensal cambie el estado, la mesa, la localidad o la organizacion de su sesion. Cierra el hueco que la combinacion OR de politicas permisivas dejaba abierto (LL-022).';

create trigger table_sessions_comensal_no_escala
  before update on public.table_sessions
  for each row execute function camarero_comensal_no_escala_sesion();

-- ---------------------------------------------------------------------------
-- 4. Aprobar deja la sesion viva y con la actividad al dia
-- ---------------------------------------------------------------------------
--
-- Se reemplaza la puerta unica de 0019 para que, al aprobar, la sesion arranque su reloj de
-- inactividad en ese instante y no en el de su creacion.

create or replace function camarero_decidir_emparejamiento(
  p_solicitud uuid,
  p_decision text,
  p_motivo text
) returns text
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_estado text;
  v_sesion uuid;
  v_filas integer;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision invalida: %', p_decision;
  end if;

  select pr.state, pr.session_id into v_estado, v_sesion
    from public.pairing_requests pr
   where pr.id = p_solicitud;

  if v_sesion is null then
    perform public.camarero_auditar_decision(p_solicitud, 'otro_local', null);
    return 'otro_local';
  end if;

  if v_estado is distinct from 'pending' then
    perform public.camarero_auditar_decision(p_solicitud, 'ya_decidida', v_sesion);
    return 'ya_decidida';
  end if;

  if not public.solicitud_vigente(v_sesion) then
    perform public.camarero_auditar_decision(p_solicitud, 'caducada', v_sesion);
    return 'caducada';
  end if;

  update public.pairing_requests
     set state = p_decision,
         decided_by = public.staff_actual(),
         decided_at = now(),
         reason = case
           when p_decision = 'rejected' then coalesce(nullif(p_motivo, ''), 'No especificado')
           else null
         end
   where id = p_solicitud and state = 'pending';
  get diagnostics v_filas = row_count;

  if v_filas <> 1 then
    perform public.camarero_auditar_decision(p_solicitud, 'ya_decidida', v_sesion);
    return 'ya_decidida';
  end if;

  -- Aprobar deja la sesion coherente: activa, sin ventana viva y con la actividad al dia.
  if p_decision = 'approved' then
    update public.table_sessions
       set state = 'active', pairing_expires_at = null, last_activity_at = now()
     where id = v_sesion;
  end if;

  insert into public.audit_log (org_id, actor_staff_id, action, entity, entity_id, before_json, after_json)
  values (
    public.org_del_staff(),
    public.staff_actual(),
    case
      when p_decision = 'approved' then 'pairing_request.approved'
      else 'pairing_request.rejected'
    end,
    'pairing_request',
    p_solicitud,
    jsonb_build_object('state', 'pending'),
    jsonb_build_object('state', p_decision, 'session_id', v_sesion)
  );

  return 'ok';
end;
$$;

comment on function camarero_decidir_emparejamiento(uuid, text, text) is
  'Puerta unica de la decision de emparejamiento: clasifica la causa (otro_local, ya_decidida, caducada), decide si procede, deja la sesion coherente al aprobar (activa, sin ventana y con la actividad al dia) y escribe en audit_log. Funcion de invocador: la RLS del contexto del empleado sigue mandando.';

-- ---------------------------------------------------------------------------
-- 5. Cerrar una mesa a mano, con rastro
-- ---------------------------------------------------------------------------
--
-- Funcion de INVOCADOR: la RLS del empleado sigue mandando. Si la sesion no es de su alcance,
-- no la ve y devuelve `sin_sesion`; nunca cierra la de otro local.

create function camarero_cerrar_sesion(p_mesa uuid) returns text
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_sesion uuid;
  v_estado text;
  v_filas integer;
begin
  select s.id, s.state into v_sesion, v_estado
    from public.table_sessions s
   where s.table_id = p_mesa
     and s.state not in ('closed', 'voided')
   order by s.opened_at desc, s.id desc
   limit 1;

  if v_sesion is null then
    return 'sin_sesion';
  end if;

  update public.table_sessions
     set state = 'closed', closed_at = now(), closed_by = public.staff_actual(),
         last_activity_at = now()
   where id = v_sesion and state not in ('closed', 'voided');
  get diagnostics v_filas = row_count;

  if v_filas <> 1 then
    -- Otra peticion cerro la sesion entre la lectura y la escritura.
    return 'sin_sesion';
  end if;

  insert into public.audit_log (org_id, actor_staff_id, action, entity, entity_id, before_json, after_json)
  values (
    public.org_del_staff(),
    public.staff_actual(),
    'table_session.closed',
    'table_session',
    v_sesion,
    jsonb_build_object('state', v_estado),
    jsonb_build_object('state', 'closed')
  );

  return 'ok';
end;
$$;

comment on function camarero_cerrar_sesion(uuid) is
  'Cierra a mano la sesion abierta de una mesa: deja closed_at, closed_by y una fila en audit_log. Funcion de invocador: la RLS decide si la mesa es del alcance del empleado. Devuelve ok o sin_sesion.';

-- ---------------------------------------------------------------------------
-- 6. Cerrar por inactividad: el cron lo hace sin que nadie mire
-- ---------------------------------------------------------------------------
--
-- El parametro `p_ahora` existe para poder DEMOSTRAR el paso del tiempo: el cron llama sin
-- argumento (usa `now()`), y una prueba puede adelantar el reloj sin tocar la fila.
create function camarero_cerrar_sesiones_inactivas(p_ahora timestamptz default now())
returns integer
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_marcadas integer;
begin
  update public.table_sessions
     set state = 'closed', closed_at = now()
   where state not in ('closed', 'voided')
     and last_activity_at < p_ahora - public.camarero_vida_de_sesion();
  get diagnostics v_marcadas = row_count;
  return v_marcadas;
end;
$$;

comment on function camarero_cerrar_sesiones_inactivas(timestamptz) is
  'Cierra las sesiones abiertas sin actividad desde hace mas de cuatro horas y devuelve cuantas. La llama el cron del borde con contexto de plataforma. El parametro p_ahora permite demostrar el paso del tiempo en las pruebas.';
