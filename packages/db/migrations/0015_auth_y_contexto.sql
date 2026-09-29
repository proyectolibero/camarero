-- 0015 — Puente entre el inicio de sesion y el contexto de la RLS.
--
-- Hasta ahora las cerraduras (politicas RLS) leian la identidad de `app.staff_id`, `app.org_id`
-- y `app.role`, pero nadie la producia: no habia inicio de sesion. Aqui se anade el puente.
--
-- PROBLEMA DEL HUEVO Y LA GALLINA. Para leer la fila de `staff` hace falta identidad, pero la
-- identidad sale de esa misma fila. La solucion NO es un rol que lo vea todo (descartado en
-- ADR-0017): son dos cerraduras minimas que dejan ver UNA fila concreta a quien presenta la
-- credencial correcta.
--
--   - El panel (dueno, encargado) entra con Supabase Auth. El borde recibe el token (JWT), lo
--     verifica, fija su reclamacion `sub` y con ello puede leer la fila de `staff` cuyo
--     `auth_user_id` coincide. Esa fila le da la organizacion, el local y el rol.
--   - La tablet del camarero presenta el token opaco del dispositivo y un PIN. Con el token
--     puede leer su fila de `staff_devices`, que le da el `staff_id` y el hash del PIN.
--
-- Los dos mecanismos son INDEPENDIENTES: la sesion del panel no abre la tablet ni al reves.
-- Y la clave de servicio (si algun dia hace falta para tareas de administracion) vive solo
-- como secreto del borde, nunca en el cliente.
--
-- SEGURIDAD. `camarero_auth_uid` y `camarero_device_token` solo leen variables de sesion
-- (`current_setting`), no tablas: no pueden provocar ciclos ni escalada. Quien presenta la
-- credencial ve su fila y nada mas.

-- ---------------------------------------------------------------------------
-- El empleado se enlaza con su usuario de Supabase Auth
-- ---------------------------------------------------------------------------

alter table staff add column auth_user_id uuid;

comment on column staff.auth_user_id is
  'Identificador del usuario en Supabase Auth (reclamacion sub del token). Nulo mientras el empleado no tenga cuenta de panel. No se declara clave foranea a auth.users para que el esquema funcione tambien en el Postgres de pruebas, que no tiene ese esquema; el enlace lo mantiene el borde. Unico por empleado.';

-- Un auth_user_id no puede apuntar a dos empleados. Indice unico parcial: los nulos no chocan.
create unique index staff_auth_user_idx on staff (auth_user_id) where auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- El identificador de usuario que viene en el token
-- ---------------------------------------------------------------------------

create function camarero_auth_uid() returns uuid
language sql stable
set search_path = pg_catalog
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

comment on function camarero_auth_uid() is
  'Reclamacion sub del token de Supabase Auth, leida de la variable de sesion que fija el borde tras verificar el token. Nula si no hay token. Solo lee configuracion de sesion: no toca ninguna tabla.';

-- Cerradura minima: quien presenta un token puede leer SU fila de empleado, y solo esa.
create policy staff_select_auth on public.staff for select
  using (auth_user_id is not null and auth_user_id = public.camarero_auth_uid());

-- ---------------------------------------------------------------------------
-- El token opaco del dispositivo, para el acceso por PIN
-- ---------------------------------------------------------------------------

create function camarero_device_token() returns text
language sql stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('app.staff_device_token', true), '')
$$;

comment on function camarero_device_token() is
  'Token opaco del dispositivo que presenta la tablet del camarero. Lo fija el borde tras recibirlo; sirve para leer la fila de staff_devices antes de tener identidad de empleado. Solo lee configuracion de sesion.';

-- Cerradura minima: la tablet puede leer SU fila de dispositivo, que le da el empleado y el hash.
create policy staff_devices_select_por_token on public.staff_devices for select
  using (device_token = public.camarero_device_token());
