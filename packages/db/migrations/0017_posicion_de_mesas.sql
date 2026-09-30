-- 0017 — Posicion de cada mesa en la cuadricula de su zona (ADR-0029).
--
-- El mapa visual necesita saber donde va cada mesa. Hasta ahora la mesa era una fila en una
-- lista; ahora ocupa una celda (fila, columna) dentro de su zona. La posicion es relativa a la
-- zona, no al local: cada zona se dibuja como su propia cuadricula.
--
-- Admision de nulo a proposito: una mesa sin colocar (recien creada o anterior a esta
-- migracion) tiene la posicion a nulo, y el panel la acomoda en el primer hueco libre. Se
-- exige que las dos coordenadas esten juntas: media posicion no es una celda.

alter table tables
  add column pos_fila integer,
  add column pos_columna integer;

comment on column tables.pos_fila is
  'Fila de la mesa en la cuadricula de su zona. Nula mientras no se ha colocado. Base 0.';
comment on column tables.pos_columna is
  'Columna de la mesa en la cuadricula de su zona. Nula mientras no se ha colocado. Base 0.';

-- No hay indices negativos: la cuadricula empieza en (0, 0).
alter table tables
  add constraint tables_pos_no_negativa check (
    (pos_fila is null or pos_fila >= 0) and (pos_columna is null or pos_columna >= 0)
  );

-- O las dos coordenadas o ninguna: media posicion no es una celda.
alter table tables
  add constraint tables_pos_completa check ((pos_fila is null) = (pos_columna is null));

-- Una celda no puede tener dos mesas en la misma zona. El `coalesce` cubre las mesas sin zona
-- (que comparten un grupo "sin zona" propio): en Postgres, nulo no choca con nulo, y aqui si
-- queremos que choque. Es la ultima red: la pantalla ya rechaza la celda ocupada, y esto evita
-- que una carrera entre dos peticiones la cuele.
create unique index tables_posicion_unica
  on tables (
    location_id,
    coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid),
    pos_fila,
    pos_columna
  )
  where pos_fila is not null;
