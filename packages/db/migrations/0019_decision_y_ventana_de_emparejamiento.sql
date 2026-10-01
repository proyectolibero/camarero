-- 0019 — Quien ve una solicitud puede decidirla; la ventana empieza al pedir (ADR-0032, LL-024).
--
-- CONTEXTO. El diagnostico midio la base real: la politica de LECTURA de `pairing_requests`
-- admite al dueno de la organizacion (`en_mi_org`) y la de ESCRITURA solo al personal del local
-- (`en_mi_local`, que exige `es_staff_de_local` y deja fuera a `org_owner`). Resultado: el unico
-- empleado del sistema VEIA la solicitud y la base le negaba actuar; el UPDATE afectaba a cero
-- filas y el codigo traducia ese cero a un mensaje generico que culpaba a la caducidad. Ademas
-- la ventana duraba 90 s y arrancaba al ESCANEAR, el estado `expired` no lo escribia nadie, un
-- local en borrador abria mesas igualmente y el fallo no dejaba rastro.
--
-- QUE HACE ESTA MIGRACION (una pieza por causa):
--
--   1. LA DECISION TOMA EL MISMO ALCANCE QUE LA LECTURA: plataforma, dueno de la organizacion
--      (`en_mi_org`) y personal del local (`en_mi_local`). `org_owner` NO entra en
--      `es_staff_de_local`: es otra figura, con alcance de organizacion y no de sede.
--   2. LA VENTANA LA FIJA PEDIR: 10 minutos, y volver a pedir la RENUEVA. La duracion vive en
--      una sola funcion (`camarero_ventana_de_emparejamiento`), para que contrato y codigo no
--      se separen. La vida de la sesion (4 h por inactividad) es otro plazo distinto.
--   3. EL COMENSAL PUEDE RENOVAR LA VENTANA DE SU SESION, pero solo mientras sigue en `pairing`
--      y sin poder tocar su mesa, su local ni su estado: aprobarse la mesa sigue siendo cosa
--      del personal.
--   4. UN LOCAL QUE NO ESTA `active` NO ABRE SESIONES DE MESA: la cerradura es el disparador
--      que ya deriva la organizacion (no una politica que lea `locations`, que cerraria el ciclo
--      locations -> table_sessions -> locations que el invariante prohibe).
--   5. UNA SOLICITUD CADUCADA SE MARCA `expired`, y lo hace el cron del borde sin que nadie
--      mire (`camarero_expirar_solicitudes`), con una politica que solo permite esa transicion.
--   6. TODA DECISION DEJA RASTRO: `decided_by`, `decided_at` y una fila en `audit_log`. Tambien
--      el intento fallido deja fila, para que un cero no vuelva a ser invisible.

-- ---------------------------------------------------------------------------
-- 1. La ventana: una sola fuente de verdad
-- ---------------------------------------------------------------------------

create function camarero_ventana_de_emparejamiento() returns interval
language sql immutable
as $$ select interval '10 minutes' $$;

comment on function camarero_ventana_de_emparejamiento() is
  'Ventana de emparejamiento: diez minutos desde que el comensal PIDE, no desde que escanea. Volver a pedir la renueva (ADR-0032).';

comment on column table_sessions.pairing_expires_at is
  'Ventana de emparejamiento: diez minutos desde que el comensal pide. Nula mientras no ha pedido y al aprobar se limpia. No confundir con la vida de la sesion (cuatro horas por inactividad).';

-- ---------------------------------------------------------------------------
-- 2. La decision toma el mismo alcance que la lectura (ADR-0032, LL-024)
-- ---------------------------------------------------------------------------

drop policy pairing_requests_update on public.pairing_requests;

create policy pairing_requests_decidir on public.pairing_requests for update
  using (
    (public.es_platform_admin()
      or public.en_mi_org(public.org_de_la_sesion(session_id))
      or public.en_mi_local(public.local_de_la_sesion(session_id)))
    and public.solicitud_vigente(session_id)
  )
  with check (
    (public.es_platform_admin()
      or public.en_mi_org(public.org_de_la_sesion(session_id))
      or public.en_mi_local(public.local_de_la_sesion(session_id)))
    and public.solicitud_vigente(session_id)
  );

comment on policy pairing_requests_decidir on public.pairing_requests is
  'Quien puede ver una solicitud pendiente puede decidirla: plataforma, dueno de la organizacion y personal del local. Es EXACTAMENTE el alcance de la lectura (LL-024). Y solo mientras la ventana sigue viva: una caducada no se aprueba.';

-- ---------------------------------------------------------------------------
-- 3. El comensal renueva la ventana de SU sesion, sin tocar su estado
-- ---------------------------------------------------------------------------

create policy table_sessions_renovar_ventana on public.table_sessions for update
  using (
    public.es_comensal()
    and id = public.sesion_actual()
    and state = 'pairing'
  )
  with check (
    public.es_comensal()
    and id = public.sesion_actual()
    and state = 'pairing'
    and table_id = public.mesa_en_contexto()
    and location_id = public.local_actual()
  );

comment on policy table_sessions_renovar_ventana on public.table_sessions is
  'El comensal puede renovar la ventana de emparejamiento de su propia sesion, pero solo mientras sigue en pairing: el with check le impide cambiar mesa, local o estado, de modo que no puede aprobarse la mesa solo.';

-- ---------------------------------------------------------------------------
-- 4. La solicitud caducada se marca; el cron lo hace sin que nadie mire
-- ---------------------------------------------------------------------------

create function solicitud_caducada(p_sesion uuid) returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.table_sessions s
    where s.id = p_sesion
      and s.pairing_expires_at is not null
      and s.pairing_expires_at <= now()
  )
$$;

comment on function solicitud_caducada(uuid) is
  'Verdadero solo si la ventana de emparejamiento de la sesion existe y ya paso. A diferencia de solicitud_vigente, una sesion sin ventana NO cuenta como caducada.';

create policy pairing_requests_expirar on public.pairing_requests for update
  using (state = 'pending' and public.solicitud_caducada(session_id))
  with check (state = 'expired');

comment on policy pairing_requests_expirar on public.pairing_requests is
  'Permite SOLO la transicion pending -> expired de una solicitud cuya ventana ya paso. La ejecuta el cron del borde con contexto de plataforma. No permite aprobar ni rechazar: eso exige la politica pairing_requests_decidir.';

create function camarero_expirar_solicitudes() returns integer
language sql
set search_path = pg_catalog
as $$
  with marcadas as (
    update public.pairing_requests pr
       set state = 'expired'
      from public.table_sessions s
     where pr.session_id = s.id
       and pr.state = 'pending'
       and s.pairing_expires_at is not null
       and s.pairing_expires_at <= now()
    returning 1
  )
  select count(*)::int from marcadas
$$;

comment on function camarero_expirar_solicitudes() is
  'Marca como expired las solicitudes pendientes cuya ventana ya paso y devuelve cuantas. La llama el cron del borde con contexto de plataforma.';

-- ---------------------------------------------------------------------------
-- 5. La decision: una sola puerta que clasifica, decide y audita
-- ---------------------------------------------------------------------------
--
-- Funcion de INVOCADOR (no definer): se ejecuta con los privilegios y el contexto del llamante,
-- asi que la RLS sigue decidiendo y no se abre ningun atajo. El panel la llama con el contexto
-- del empleado ya fijado. Devuelve la CAUSA para que el mensaje deje de ser generico (LL-024)
-- y deja rastro en audit_log tanto de la decision como del intento fallido.

create function camarero_auditar_decision(p_solicitud uuid, p_causa text, p_sesion uuid)
returns void
language sql
set search_path = pg_catalog
as $$
  insert into public.audit_log (org_id, actor_staff_id, action, entity, entity_id, after_json)
  values (
    public.org_del_staff(),
    public.staff_actual(),
    'pairing_request.decision_failed',
    'pairing_request',
    p_solicitud,
    jsonb_build_object('causa', p_causa, 'session_id', p_sesion)
  )
$$;

comment on function camarero_auditar_decision(uuid, text, uuid) is
  'Deja en audit_log el intento fallido de decidir una solicitud, con su causa. Un cero que no se registra no se puede reconstruir.';

create function camarero_decidir_emparejamiento(
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

  -- La lectura respeta la RLS: si la solicitud no es del alcance del actor, no hay fila.
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

  -- Aprobar deja la sesion coherente: activa y sin ventana de emparejamiento viva.
  if p_decision = 'approved' then
    update public.table_sessions
       set state = 'active', pairing_expires_at = null
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
  'Puerta unica de la decision de emparejamiento: clasifica la causa (otro_local, ya_decidida, caducada), decide si procede, deja la sesion coherente al aprobar y escribe en audit_log. Funcion de invocador: la RLS del contexto del empleado sigue mandando.';

-- ---------------------------------------------------------------------------
-- 6. Un local que no esta activo no abre sesiones de mesa
-- ---------------------------------------------------------------------------

create or replace function camarero_completar_org_sesion()
returns trigger
language plpgsql
security definer
-- Solo pg_catalog: nada de `public` en la ruta de busqueda (RISK-017).
set search_path = pg_catalog
as $$
declare
  v_estado text;
begin
  -- Comensal anonimo desde el QR: la mesa manda. Ni la localidad ni la organizacion se
  -- aceptan de la fila; se derivan de la mesa y de su local.
  if public.rol_actual() is null and public.codigo_de_mesa() is not null then
    select t.location_id into new.location_id from public.tables t where t.id = new.table_id;
    if new.location_id is null then
      raise exception 'La mesa % no es visible desde el codigo de contexto', new.table_id;
    end if;
    select l.org_id, l.status into new.org_id, v_estado
      from public.locations l where l.id = new.location_id;
    if v_estado is distinct from 'active' then
      raise exception 'El local % no esta activo: no abre sesiones de mesa', new.location_id;
    end if;
  end if;
  if new.org_id is null then
    -- Referencia CUALIFICADA: con `public.` delante, una tabla temporal homonima ya no puede
    -- interceptar la lectura (RISK-017).
    select l.org_id into new.org_id from public.locations l where l.id = new.location_id;
  end if;
  if new.org_id is null then
    raise exception 'No se pudo determinar org_id para la sesion %', new.id;
  end if;
  return new;
end;
$$;

comment on function camarero_completar_org_sesion() is
  'Trigger BEFORE INSERT: deriva la localidad de la mesa y la organizacion del local y, para el comensal anonimo, exige que el local este active. Ni la localidad ni la organizacion se aceptan de la fila. search_path solo pg_catalog y referencias cualificadas: sin esto, una tabla temporal puede secuestrar la lectura (RISK-017).';
