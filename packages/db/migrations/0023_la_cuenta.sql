-- 0023 — La cuenta: pedirla una vez y no volver a pedir platos (TASK-F3-01, D-039).
--
-- CONTEXTO. El esquema ya tenia `bill_requests` y `checkouts`, pero el flujo no existia: el
-- comensal no podia pedir la cuenta y el local no podia registrar el cobro. Ademas, una vez
-- pedida la cuenta el comensal seguia pudiendo insertar comandas: la unica barrera era el
-- boton de la pantalla, y la pantalla no es la cerradura.
--
-- QUE HACE ESTA MIGRACION:
--   1. La cuenta se pide SIN reparto (`split_mode = 'none'`): aqui es una cuenta para la
--      mesa. Los cuatro modos de reparto llegan despues y no se adelantan.
--   2. El comensal NO puede crear comandas mientras su sesion tenga una cuenta viva. La
--      barrera es la BASE (`puede_crear_orden`), no la pantalla: forzar el POST no sirve.
--      El personal no se ve afectado: su brazo de la funcion no cambia.

alter table public.bill_requests
  alter column split_mode set default 'none';

alter table public.bill_requests
  drop constraint bill_requests_split_mode_valido;

alter table public.bill_requests
  add constraint bill_requests_split_mode_valido
  check (split_mode in ('none', 'by_item', 'equal', 'half', 'manual'));

comment on column public.bill_requests.split_mode is
  'Modo de reparto: none (una cuenta para la mesa), by_item, equal, half o manual (CONTRACT-dinero). En el piloto, se pide una cuenta por mesa.';

-- La comanda se crea con la org/local de la sesion y SOLO mientras no se haya pedido la
-- cuenta. Si hay una cuenta viva (requested, preparing o ready) el comensal deja de poder
-- insertar lineas; el personal (plataforma, dueno o empleado del local) no se ve afectado.
create or replace function public.puede_crear_orden(p_org uuid, p_local uuid, p_sesion uuid)
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
        and not exists (
          select 1 from public.bill_requests b
          where b.session_id = p_sesion
            and b.state in ('requested', 'preparing', 'ready')
        )
      )
$$;

comment on function public.puede_crear_orden(uuid, uuid, uuid) is
  'Alta de una comanda: el comensal solo en su sesion, con la org/local de esa sesion y SOLO mientras no haya pedido la cuenta; el personal, en un local que opera. Pedir la cuenta cierra la via de pedir platos, tambien por la via directa.';
