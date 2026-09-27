-- 0011 — Cierra un secuestro de la ruta de busqueda en la funcion de 0008.
--
-- HALLAZGO CRITICO, confirmado con prueba ejecutada (RISK-017). La funcion
-- `camarero_completar_org_sesion()` de 0008 se escribio asi:
--
--     set search_path = pg_catalog, public
--     ...
--     select l.org_id into new.org_id from locations l where l.id = new.location_id;
--
-- `locations` esta SIN CUALIFICAR. PostgreSQL resuelve los nombres de relacion en
-- `pg_temp` ANTES que en el search_path, incluso aunque `pg_temp` no aparezca en el. Un
-- llamante con privilegio TEMP crea una tabla temporal llamada `locations`, le concede
-- lectura al propietario de la funcion, e inserta una sesion: el disparador lee SU tabla,
-- no la de verdad, y la sesion queda con el org_id que el atacante quiera.
--
-- Consecuencia en cadena: desde esa sesion, `org_de_sesion()` devuelve la organizacion
-- ajena, `puede_crear_orden()` acepta comandas con organizacion ajena, y el dueno de esa
-- organizacion pasa a ver sesiones y comandas de un local que no es suyo.
--
-- El proyecto ya tenia 33 funciones endurecidas correctamente en 0009: `search_path` fijo
-- a `pg_catalog` y TODAS las referencias cualificadas con `public.`. Esta funcion, escrita
-- en otra migracion, no siguio ese patron y nada lo comprobaba.
--
-- Arreglo: dos lineas. El endurecimiento de verdad es el test invariante que acompaña a
-- esta migracion y que recorre todas las funciones SECURITY DEFINER del esquema.

create or replace function camarero_completar_org_sesion()
returns trigger
language plpgsql
security definer
-- Solo pg_catalog: nada de `public` en la ruta de busqueda.
set search_path = pg_catalog
as $$
begin
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
  'Trigger BEFORE INSERT: completa org_id de una sesion desde su local. Falla en voz alta si el local no existe. search_path solo pg_catalog y referencia cualificada: sin esto, una tabla temporal puede secuestrar la lectura (RISK-017).';

-- La migracion de datos de 0008 (`update ... from locations l`) no esta afectada: las
-- migraciones se ejecutan como el propietario en un contexto controlado, sin tablas
-- temporales de terceros. El endurecimiento aplica a lo que se ejecuta en cada peticion.
