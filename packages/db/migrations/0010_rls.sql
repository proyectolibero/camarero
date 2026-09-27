-- 0010 — Row Level Security de las 28 tablas del contrato.
--
-- Reglas de aislamiento (briefing):
--   platform_admin  -> todo.
--   org_owner       -> su organizacion (app.org_id).
--   location_manager, server, kitchen, no_pin -> su local, derivado de la fila de staff.
--   comensal anonimo (sin rol, con app.session_id) -> su local (solo carta activa y
--     disponible), su sesion, sus comandas, su peticion de cuenta.
--
-- El defecto es DENEGAR: sin actor, todas las condiciones son falsas y no se ve ninguna
-- fila. No se usa `using (true)` en ninguna politica.
--
-- Cada tabla lleva ENABLE y FORCE ROW LEVEL SECURITY. FORCE hace que las politicas se
-- apliquen tambien a camarero_owner (el propietario). Sin FORCE, conectar como
-- propietario saltaria la RLS y los tests pasarian siempre (LL-004).
--
-- No se crea politica de escritura donde no hay caso de uso: el rol de aplicacion puede
-- tener el GRANT (en desarrollo lo tiene), pero la ausencia de politica hace que la
-- operacion afecte a 0 filas. Eso es deliberado y se explica por tabla.

-- ---------------------------------------------------------------------------
-- Activar y forzar RLS en las 28 tablas
-- ---------------------------------------------------------------------------

alter table public.orgs enable row level security;
alter table public.orgs force row level security;
alter table public.locations enable row level security;
alter table public.locations force row level security;
alter table public.opening_hours enable row level security;
alter table public.opening_hours force row level security;
alter table public.zones enable row level security;
alter table public.zones force row level security;
alter table public.tables enable row level security;
alter table public.tables force row level security;
alter table public.table_links enable row level security;
alter table public.table_links force row level security;
alter table public.staff enable row level security;
alter table public.staff force row level security;
alter table public.staff_devices enable row level security;
alter table public.staff_devices force row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_categories force row level security;
alter table public.menu_items enable row level security;
alter table public.menu_items force row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_groups force row level security;
alter table public.modifier_options enable row level security;
alter table public.modifier_options force row level security;
alter table public.item_modifier_groups enable row level security;
alter table public.item_modifier_groups force row level security;
alter table public.table_sessions enable row level security;
alter table public.table_sessions force row level security;
alter table public.table_devices enable row level security;
alter table public.table_devices force row level security;
alter table public.pairing_requests enable row level security;
alter table public.pairing_requests force row level security;
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.order_items enable row level security;
alter table public.order_items force row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.order_item_modifiers force row level security;
alter table public.promotions enable row level security;
alter table public.promotions force row level security;
alter table public.bill_requests enable row level security;
alter table public.bill_requests force row level security;
alter table public.checkouts enable row level security;
alter table public.checkouts force row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
alter table public.kitchen_stations enable row level security;
alter table public.kitchen_stations force row level security;
alter table public.daily_metrics enable row level security;
alter table public.daily_metrics force row level security;
alter table public.ratelimit_counters enable row level security;
alter table public.ratelimit_counters force row level security;
alter table public.idempotency_keys enable row level security;
alter table public.idempotency_keys force row level security;

-- ===========================================================================
-- Identidad y locales
-- ===========================================================================

-- orgs: la plataforma ve todas; el dueno, la suya. Solo la plataforma crea o borra
-- organizaciones; el dueno puede actualizar la suya (nombre, razon social, plan).
create policy orgs_select on public.orgs for select
  using (public.es_platform_admin() or public.en_mi_org(id));
create policy orgs_insert on public.orgs for insert
  with check (public.es_platform_admin());
create policy orgs_update on public.orgs for update
  using (public.es_platform_admin() or public.en_mi_org(id))
  with check (public.es_platform_admin() or public.en_mi_org(id));
create policy orgs_delete on public.orgs for delete
  using (public.es_platform_admin());

-- locations: se resuelve por columna directa (nunca leyendo locations desde su propia
-- politica, que provocaria recursion). El comensal ve el local de su sesion.
create policy locations_select on public.locations for select
  using (
    public.es_platform_admin()
    or (public.es_org_owner() and org_id = public.org_actual())
    or public.en_mi_local(id)
    or public.en_mi_local_comensal(id)
  );
create policy locations_insert on public.locations for insert
  with check (
    public.es_platform_admin()
    or (public.es_org_owner() and org_id = public.org_actual())
  );
create policy locations_update on public.locations for update
  using (
    public.es_platform_admin()
    or (public.es_org_owner() and org_id = public.org_actual())
  )
  with check (
    public.es_platform_admin()
    or (public.es_org_owner() and org_id = public.org_actual())
  );
-- Sin politica de DELETE: un local se pausa, no se borra (locations.status).
create policy locations_delete on public.locations for delete
  using (public.es_platform_admin());

-- opening_hours: gestion del local; el comensal puede leer el horario de su local.
create policy opening_hours_select on public.opening_hours for select
  using (public.ve_local_personal(location_id) or public.en_mi_local_comensal(location_id));
create policy opening_hours_insert on public.opening_hours for insert
  with check (public.puede_gestionar(location_id));
create policy opening_hours_update on public.opening_hours for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy opening_hours_delete on public.opening_hours for delete
  using (public.puede_gestionar(location_id));

-- zones: plano interno del local; el comensal no lo necesita.
create policy zones_select on public.zones for select
  using (public.ve_local_personal(location_id));
create policy zones_insert on public.zones for insert
  with check (public.puede_gestionar(location_id));
create policy zones_update on public.zones for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy zones_delete on public.zones for delete
  using (public.puede_gestionar(location_id));

-- tables: el comensal anonimo solo ve la mesa de su propia sesion.
create policy tables_select on public.tables for select
  using (public.ve_local_personal(location_id) or public.tabla_de_mi_sesion(id));
create policy tables_insert on public.tables for insert
  with check (public.puede_gestionar(location_id));
create policy tables_update on public.tables for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy tables_delete on public.tables for delete
  using (public.puede_gestionar(location_id));

-- table_links: union de mesas; mismo alcance que las mesas que une.
create policy table_links_select on public.table_links for select
  using (public.ve_local_personal(public.local_de_mesa(group_id)));
create policy table_links_insert on public.table_links for insert
  with check (public.puede_gestionar(public.local_de_mesa(group_id)));
create policy table_links_update on public.table_links for update
  using (public.puede_gestionar(public.local_de_mesa(group_id)))
  with check (public.puede_gestionar(public.local_de_mesa(group_id)));
create policy table_links_delete on public.table_links for delete
  using (public.puede_gestionar(public.local_de_mesa(group_id)));

-- ===========================================================================
-- Personal, dispositivos y auditoria
-- ===========================================================================

-- staff: la politica no puede leer `staff` (recursion) ni `local_del_staff()`, asi que
-- el aislamiento del empleado es por organizacion o por su propia fila. El encargado no
-- ve colegas de su local a traves de esta tabla; si hiciera falta, seria otra tarea.
create policy staff_select on public.staff for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(org_id)
    or id = public.staff_actual()
  );
create policy staff_insert on public.staff for insert
  with check (public.es_platform_admin() or public.en_mi_org(org_id));
create policy staff_update on public.staff for update
  using (public.es_platform_admin() or public.en_mi_org(org_id))
  with check (public.es_platform_admin() or public.en_mi_org(org_id));
create policy staff_delete on public.staff for delete
  using (public.es_platform_admin() or public.en_mi_org(org_id));

-- staff_devices: el empleado ve y gestiona su propio dispositivo; el dueno, los de su org.
create policy staff_devices_select on public.staff_devices for select
  using (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );
create policy staff_devices_insert on public.staff_devices for insert
  with check (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );
create policy staff_devices_update on public.staff_devices for update
  using (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  )
  with check (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );
create policy staff_devices_delete on public.staff_devices for delete
  using (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );

-- audit_log: APPEND-ONLY. Se permite insertar con la organizacion correcta, pero NO
-- existe politica de UPDATE ni de DELETE. Aunque camarero_app tenga el GRANT (en
-- desarrollo lo tiene), ninguna fila es modificable ni borrable. La inmutabilidad la
-- garantiza la ausencia de politica, no la ausencia de privilegio.
create policy audit_log_select on public.audit_log for select
  using (public.es_platform_admin() or public.en_mi_org(org_id));
create policy audit_log_insert on public.audit_log for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_org(org_id)
    or (public.es_staff_de_local() and org_id = public.org_del_staff())
  );

-- ===========================================================================
-- Carta
-- ===========================================================================

-- menu_categories: el comensal solo ve categorias activas y disponibles de su local.
create policy menu_categories_select on public.menu_categories for select
  using (
    public.ve_local_personal(location_id)
    or (public.en_mi_local_comensal(location_id) and active and available)
  );
create policy menu_categories_insert on public.menu_categories for insert
  with check (public.puede_gestionar(location_id));
create policy menu_categories_update on public.menu_categories for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy menu_categories_delete on public.menu_categories for delete
  using (public.puede_gestionar(location_id));

-- menu_items: mismas reglas; el comensal solo ve platos activos y disponibles. Cocina y
-- camarero pueden leer, pero no tienen politica de UPDATE, asi que no pueden tocar
-- precios.
create policy menu_items_select on public.menu_items for select
  using (
    public.ve_local_personal(location_id)
    or (public.en_mi_local_comensal(location_id) and active and available)
  );
create policy menu_items_insert on public.menu_items for insert
  with check (public.puede_gestionar(location_id));
create policy menu_items_update on public.menu_items for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy menu_items_delete on public.menu_items for delete
  using (public.puede_gestionar(location_id));

create policy modifier_groups_select on public.modifier_groups for select
  using (public.ve_local_personal(location_id) or public.en_mi_local_comensal(location_id));
create policy modifier_groups_insert on public.modifier_groups for insert
  with check (public.puede_gestionar(location_id));
create policy modifier_groups_update on public.modifier_groups for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy modifier_groups_delete on public.modifier_groups for delete
  using (public.puede_gestionar(location_id));

create policy modifier_options_select on public.modifier_options for select
  using (
    public.ve_local_personal(public.local_de_grupo(group_id))
    or public.en_mi_local_comensal(public.local_de_grupo(group_id))
  );
create policy modifier_options_insert on public.modifier_options for insert
  with check (public.puede_gestionar(public.local_de_grupo(group_id)));
create policy modifier_options_update on public.modifier_options for update
  using (public.puede_gestionar(public.local_de_grupo(group_id)))
  with check (public.puede_gestionar(public.local_de_grupo(group_id)));
create policy modifier_options_delete on public.modifier_options for delete
  using (public.puede_gestionar(public.local_de_grupo(group_id)));

create policy item_modifier_groups_select on public.item_modifier_groups for select
  using (
    public.ve_local_personal(public.local_de_item(item_id))
    or public.en_mi_local_comensal(public.local_de_item(item_id))
  );
create policy item_modifier_groups_insert on public.item_modifier_groups for insert
  with check (public.puede_gestionar(public.local_de_item(item_id)));
create policy item_modifier_groups_update on public.item_modifier_groups for update
  using (public.puede_gestionar(public.local_de_item(item_id)))
  with check (public.puede_gestionar(public.local_de_item(item_id)));
create policy item_modifier_groups_delete on public.item_modifier_groups for delete
  using (public.puede_gestionar(public.local_de_item(item_id)));

-- ===========================================================================
-- Sesiones y comandas
-- ===========================================================================

-- table_sessions: el comensal ve la sesion que le identifica y con la que se une; el
-- personal ve las de su local; el dueno, las de su org. No se borran sesiones.
create policy table_sessions_select on public.table_sessions for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(org_id)
    or public.en_mi_local(location_id)
    or public.en_mi_sesion(id)
  );
create policy table_sessions_insert on public.table_sessions for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_org(org_id)
    or public.en_mi_local(location_id)
  );
create policy table_sessions_update on public.table_sessions for update
  using (
    public.es_platform_admin()
    or public.en_mi_org(org_id)
    or public.en_mi_local(location_id)
  )
  with check (
    public.es_platform_admin()
    or public.en_mi_org(org_id)
    or public.en_mi_local(location_id)
  );

-- table_devices: el comensal ve y registra los dispositivos de su sesion; el personal,
-- los de su local. No se borran dispositivos (se podan por last_seen).
create policy table_devices_select on public.table_devices for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  );
create policy table_devices_insert on public.table_devices for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  );
create policy table_devices_update on public.table_devices for update
  using (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  )
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  );

-- pairing_requests: el comensal crea y lee las peticiones de su sesion (solo para su
-- mesa); el personal de su local las decide. No se borran, se resuelven por estado.
create policy pairing_requests_select on public.pairing_requests for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  );
create policy pairing_requests_insert on public.pairing_requests for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or (public.en_mi_sesion(session_id) and public.tabla_de_mi_sesion(table_id))
  );
create policy pairing_requests_update on public.pairing_requests for update
  using (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  )
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  );

-- orders: el comensal ve y crea solo las de su sesion, y con la org/local de esa sesion.
-- El personal opera las de su local. No se borran comandas: se anulan por estado.
create policy orders_select on public.orders for select
  using (public.ve_orden(org_id, location_id, session_id));
create policy orders_insert on public.orders for insert
  with check (public.puede_crear_orden(org_id, location_id, session_id));
create policy orders_update on public.orders for update
  using (public.puede_operar(location_id))
  with check (public.puede_operar(location_id));

-- order_items: la visibilidad de la linea es la de su comanda.
create policy order_items_select on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.ve_orden(o.org_id, o.location_id, o.session_id)
    )
  );
create policy order_items_insert on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.puede_crear_orden(o.org_id, o.location_id, o.session_id)
    )
  );
create policy order_items_update on public.order_items for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.puede_operar(o.location_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.puede_operar(o.location_id)
    )
  );
create policy order_items_delete on public.order_items for delete
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.puede_operar(o.location_id)
    )
  );

-- order_item_modifiers: alcance de la comanda, uniendo linea y comanda.
create policy order_item_modifiers_select on public.order_item_modifiers for select
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id
        and public.ve_orden(o.org_id, o.location_id, o.session_id)
    )
  );
create policy order_item_modifiers_insert on public.order_item_modifiers for insert
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id
        and public.puede_crear_orden(o.org_id, o.location_id, o.session_id)
    )
  );
create policy order_item_modifiers_update on public.order_item_modifiers for update
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and public.puede_operar(o.location_id)
    )
  )
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and public.puede_operar(o.location_id)
    )
  );
create policy order_item_modifiers_delete on public.order_item_modifiers for delete
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and public.puede_operar(o.location_id)
    )
  );

-- ===========================================================================
-- Promociones y cuenta
-- ===========================================================================

-- promotions: configuracion del local; el comensal no la lee (el descuento se aplica en
-- el servidor, nunca con datos que vengan del cliente).
create policy promotions_select on public.promotions for select
  using (public.ve_local_personal(location_id));
create policy promotions_insert on public.promotions for insert
  with check (public.puede_gestionar(location_id));
create policy promotions_update on public.promotions for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy promotions_delete on public.promotions for delete
  using (public.puede_gestionar(location_id));

-- bill_requests: el comensal pide y lee la cuenta de su sesion; el personal la prepara.
create policy bill_requests_select on public.bill_requests for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  );
create policy bill_requests_insert on public.bill_requests for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
    or public.en_mi_sesion(session_id)
  );
create policy bill_requests_update on public.bill_requests for update
  using (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  )
  with check (
    public.es_platform_admin()
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  );

-- checkouts: NUNCA visibles para el comensal. Solo el personal autorizado registra un
-- cobro; es un hecho, no se modifica ni se borra.
create policy checkouts_select on public.checkouts for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or public.en_mi_local(public.local_de_la_sesion(session_id))
  );
create policy checkouts_insert on public.checkouts for insert
  with check (
    public.es_platform_admin()
    or public.en_mi_org(public.org_de_la_sesion(session_id))
    or (public.es_cobrador() and public.en_mi_local(public.local_de_la_sesion(session_id)))
  );

-- ===========================================================================
-- Plataforma
-- ===========================================================================

-- push_subscriptions: cada empleado gestiona las suyas; el dueno ve las de su org.
create policy push_subscriptions_select on public.push_subscriptions for select
  using (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );
create policy push_subscriptions_insert on public.push_subscriptions for insert
  with check (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );
create policy push_subscriptions_update on public.push_subscriptions for update
  using (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  )
  with check (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );
create policy push_subscriptions_delete on public.push_subscriptions for delete
  using (
    public.es_platform_admin()
    or staff_id = public.staff_actual()
    or public.en_mi_org(public.org_del_staff_de(staff_id))
  );

-- kitchen_stations: configuracion del KDS de un local.
create policy kitchen_stations_select on public.kitchen_stations for select
  using (public.ve_local_personal(location_id));
create policy kitchen_stations_insert on public.kitchen_stations for insert
  with check (public.puede_gestionar(location_id));
create policy kitchen_stations_update on public.kitchen_stations for update
  using (public.puede_gestionar(location_id))
  with check (public.puede_gestionar(location_id));
create policy kitchen_stations_delete on public.kitchen_stations for delete
  using (public.puede_gestionar(location_id));

-- daily_metrics: agregados sin PII para el dueno y el encargado. Sin politica de
-- escritura: las calcula un proceso de plataforma con rol de servicio, no la aplicacion.
create policy daily_metrics_select on public.daily_metrics for select
  using (
    public.es_platform_admin()
    or public.en_mi_org(public.org_del_local(location_id))
    or public.en_mi_local(location_id)
  );

-- ratelimit_counters: tabla de plataforma, sin org_id. NO tiene politicas. Con RLS
-- activada y forzada, el defecto es denegar: ni los actores normales ni el propietario
-- ven o tocan nada. La gestiona el rol de servicio (BYPASSRLS), que no existe en este
-- entorno de pruebas a proposito, para que la denegacion quede probada.

-- idempotency_keys: global pero con org_id. Una organizacion no ve las respuestas
-- cacheadas de otra. Solo la plataforma poda (delete).
create policy idempotency_keys_select on public.idempotency_keys for select
  using (public.es_platform_admin() or public.en_mi_org(org_id));
create policy idempotency_keys_insert on public.idempotency_keys for insert
  with check (public.es_platform_admin() or public.en_mi_org(org_id));
create policy idempotency_keys_update on public.idempotency_keys for update
  using (public.es_platform_admin() or public.en_mi_org(org_id))
  with check (public.es_platform_admin() or public.en_mi_org(org_id));
create policy idempotency_keys_delete on public.idempotency_keys for delete
  using (public.es_platform_admin());

-- ===========================================================================
-- Privilegios de camarero_app
-- ===========================================================================
--
-- Se conceden DML por tabla de forma explicita (nada de `grant all`). El GRANT no es la
-- barrera: con RLS activada y forzada, quien decide que fila es visible o escribible es
-- la politica. Se conceden tambien los privilegios que no tienen politica (checkouts,
-- daily_metrics, ratelimit_counters, audit_log) para que la denegacion se demuestre por
-- RLS y no por falta de privilegio, que era justo el falso positivo de LL-004.

grant usage on schema public to camarero_app;

grant select, insert, update, delete on
  public.orgs,
  public.locations,
  public.opening_hours,
  public.zones,
  public.tables,
  public.table_links,
  public.staff,
  public.staff_devices,
  public.audit_log,
  public.menu_categories,
  public.menu_items,
  public.modifier_groups,
  public.modifier_options,
  public.item_modifier_groups,
  public.table_sessions,
  public.table_devices,
  public.pairing_requests,
  public.orders,
  public.order_items,
  public.order_item_modifiers,
  public.promotions,
  public.bill_requests,
  public.checkouts,
  public.push_subscriptions,
  public.kitchen_stations,
  public.daily_metrics,
  public.ratelimit_counters,
  public.idempotency_keys
to camarero_app;
