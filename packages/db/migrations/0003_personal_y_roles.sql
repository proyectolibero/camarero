-- 0003 — Personal, dispositivos y auditoria.
--
-- Quien opera el local y con que rol; los dispositivos con PIN de cada empleado; y el
-- registro inmutable de acciones. El comensal no aparece aqui: es anonimo (D-007) y su
-- unico rastro son alias de mesa en 0005.

create table staff (
  id uuid primary key default camarero_uuid_v7(),
  org_id uuid not null references orgs (id) on delete restrict,
  location_id uuid references locations (id) on delete restrict,
  email text not null,
  role text not null,
  display_name text not null,
  pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_org_email_unico unique (org_id, email),
  constraint staff_email_formato check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint staff_role_valido check (
    role in ('platform_admin', 'org_owner', 'location_manager', 'server', 'kitchen', 'no_pin')
  ),
  constraint staff_no_pin_sin_hash check (role <> 'no_pin' or pin_hash is null)
);

comment on table staff is
  'Empleado o colaborador con acceso al panel o al KDS. Un mismo correo puede existir en organizaciones distintas (unicidad por org).';
comment on column staff.org_id is 'Organizacion a la que pertenece el empleado.';
comment on column staff.location_id is
  'Local asignado. Nulo significa que el empleado cubre todos los locales de la organizacion.';
comment on column staff.role is
  'Rol: platform_admin, org_owner, location_manager, server, kitchen o no_pin. no_pin entra sin PIN a una tablet compartida: ve comandas pero no toca precios ni cobros.';
comment on column staff.pin_hash is
  'Hash del PIN. Nunca el PIN en claro. Nulo en roles que se autentican por otro medio; siempre nulo para no_pin.';
comment on column staff.active is 'false para dar de baja a un empleado sin borrar su historial de auditoria y de comandas.';

create index staff_org_idx on staff (org_id);
create index staff_location_idx on staff (location_id);

create trigger staff_set_updated_at
  before update on staff
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Dispositivos de personal
-- ---------------------------------------------------------------------------

create table staff_devices (
  id uuid primary key default camarero_uuid_v7(),
  staff_id uuid not null references staff (id) on delete cascade,
  device_token text not null,
  pin_fail_count integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_devices_token_unico unique (device_token),
  constraint staff_devices_fallos_no_negativos check (pin_fail_count >= 0)
);

comment on table staff_devices is
  'Dispositivo reconocido de un empleado. Sostiene el bloqueo por PIN fallido: la tablet recuerda cuantas veces se fallo y hasta cuando esta bloqueada.';
comment on column staff_devices.device_token is
  'Token opaco del dispositivo. Unico en todo el sistema. Puede rotarse borrando la fila.';
comment on column staff_devices.pin_fail_count is 'Intentos de PIN fallidos en este dispositivo. Se reinicia al acertar.';
comment on column staff_devices.locked_until is 'Instante hasta el que el dispositivo queda bloqueado. Nulo si no lo esta.';

create index staff_devices_staff_idx on staff_devices (staff_id);

create trigger staff_devices_set_updated_at
  before update on staff_devices
  for each row execute function camarero_set_updated_at();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

create table audit_log (
  id uuid primary key default camarero_uuid_v7(),
  org_id uuid not null references orgs (id) on delete restrict,
  actor_staff_id uuid references staff (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

comment on table audit_log is
  'Registro inmutable de acciones. Nunca se actualiza ni se borra: es la memoria de lo ocurrido y la prueba ante una disputa. Los cambios de estado de comanda van aqui (CONTRACT-estados-comanda).';
comment on column audit_log.actor_staff_id is
  'Empleado que ejecuto la accion. on delete set null para no perder la entrada aunque se borre al empleado; nadie deberia borrarlo, se desactiva con active.';
comment on column audit_log.action is 'Accion ejecutada, por ejemplo order.status_changed.';
comment on column audit_log.entity is 'Tipo de entidad afectada, por ejemplo order o table_session.';
comment on column audit_log.entity_id is 'Identificador de la entidad afectada. Nulo si la accion no apunta a una fila concreta.';
comment on column audit_log.before_json is 'Instantanea del estado anterior. Nula en altas.';
comment on column audit_log.after_json is 'Instantanea del estado posterior. Nula en bajas.';

create index audit_log_org_fecha_idx on audit_log (org_id, created_at desc);
create index audit_log_entidad_idx on audit_log (entity, entity_id);
create index audit_log_actor_idx on audit_log (actor_staff_id);
