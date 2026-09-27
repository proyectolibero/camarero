-- 0008 — org_id desnormalizado en table_sessions.
--
-- Por que: la politica de `locations` para el comensal anonimo necesita leer la sesion
-- (para saber en que local esta) y la politica de `table_sessions` para el dueno
-- necesitaba leer `locations` para conocer su organizacion. Esa dependencia mutua hace
-- que PostgreSQL aborte la consulta con "infinite recursion detected in policy for
-- relation". Copiando org_id en la sesion, la politica del dueno deja de leer
-- `locations` y el ciclo desaparece.
--
-- Ademas table_sessions se consulta en el camino de cada comanda, asi que el join que
-- se evita se pagaba siempre. La desnormalizacion es deliberada y no rompe el modelo:
-- org_id es derivable del local y no cambia nunca en la vida de una sesion.

alter table table_sessions
  add column org_id uuid references orgs (id) on delete restrict;

-- Relleno de filas existentes: en una instalacion con datos, la organizacion se deriva
-- del local. Se deja not null despues para que la desnormalizacion sea una invariante.
update table_sessions s
set org_id = l.org_id
from locations l
where l.id = s.location_id
  and s.org_id is null;

alter table table_sessions alter column org_id set not null;

create index table_sessions_org_idx on table_sessions (org_id);

comment on column table_sessions.org_id is
  'Organizacion propietaria, copiada del local. Desnormalizacion consciente para romper la recursion de politicas RLS entre table_sessions y locations.';

-- El caso de uso no tiene por que conocer org_id al abrir una sesion: el trigger lo
-- completa desde el local. Se ejecuta como propietario para que la lectura del local no
-- dependa de los permisos del llamante.
create function camarero_completar_org_sesion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.org_id is null then
    select l.org_id into new.org_id from locations l where l.id = new.location_id;
  end if;
  if new.org_id is null then
    raise exception 'No se pudo determinar org_id para la sesion %', new.id;
  end if;
  return new;
end;
$$;

comment on function camarero_completar_org_sesion() is
  'Trigger BEFORE INSERT: completa org_id de una sesion desde su local. Falla en voz alta si el local no existe, en lugar de dejar la fila sin organizacion.';

create trigger table_sessions_completar_org
  before insert on table_sessions
  for each row execute function camarero_completar_org_sesion();
