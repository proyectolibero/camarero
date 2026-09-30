-- Retira de las bases donde ya existe la tabla de pruebas del runner.
--
-- `prueba_runner` nunca fue parte del esquema del producto: solo existia para confirmar que
-- el runner aplicaba migraciones en orden. Se creaba en 0001 y viajo a produccion sin querer.
-- La tabla que necesitan las pruebas se crea ahora en el entorno de pruebas
-- (packages/db/tests), no en una migracion. Esta migracion la elimina donde ya quedo.

drop table if exists public.prueba_runner;
