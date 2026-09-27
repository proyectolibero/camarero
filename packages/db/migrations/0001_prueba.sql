-- Migracion minima del runner de pruebas.
--
-- No forma parte del esquema del producto (esa es la tarea siguiente). Solo sirve
-- para confirmar que el runner aplica migraciones en orden y que la tabla resultante
-- pertenece a camarero_owner, no a camarero_app.

create table prueba_runner (
  id integer primary key,
  descripcion text not null
);

insert into prueba_runner (id, descripcion)
values (1, 'Fila insertada por la migracion de prueba del runner');
