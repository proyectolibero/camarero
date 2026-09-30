---
id: CONTRACT-borde
type: contract
title: "CONTRACT-borde — El borde de Cloudflare: Pages, Workers, R2 y Supabase"
status: active
date: 2026-09-30
tags:
  - borde
  - infraestructura
  - cloudflare
  - supabase
  - contrato
  - copias
related:
  - ADR-0002
  - ADR-0018
  - ADR-0019
  - ADR-0020
  - ADR-0021
  - ADR-0023
  - ADR-0024
  - ADR-0026
  - TASK-F0-03
  - TASK-F0-04
  - TASK-F0-05
  - TASK-F0-08
  - TASK-F0-09
  - LL-014
  - LL-016
  - LL-018
  - CONTRACT-pantallas
  - RISK-001
  - RISK-020
---

## Que es el borde

El borde es todo lo que hay entre el comensal y la base de datos: la web, la API de Cloudflare y el almacen de imagenes. Un solo proveedor (Cloudflare) y un solo dominio global (D-023). Ver `ADR-0002`, `ADR-0018`, `ADR-0020` y `CONTRACT-pantallas`.

## Las piezas

| Pieza | Donde | Que hace |
|-------|-------|----------|
| **Web** | Cloudflare Pages, carpeta `apps/web` | Sirve la PWA del comensal (de momento, una pagina vacia). |
| **API** | Cloudflare Worker, `workers/api` | Expone `GET /health`, `POST /auth/sesion` y **los paneles del dueno (`/admin`) y de plataforma (`/panel`)**, que se dibujan en el servidor (`ADR-0023`). Ademas lleva un **cron diario de keep-alive** (`ADR-0026`). |
| **Carta** | Cloudflare R2, bucket `camarero-cartas` | Guarda las imagenes de la carta. 10 GB gratis. |
| **Copias** | Cloudflare R2, bucket `camarero-copias` | Guarda las copias de seguridad cifradas de la base. |

## Regla de despliegue

**Produccion solo se publica desde `main` y solo despues de que CI pase.** Esta en `.github/workflows/deploy.yml`: se dispara cuando el workflow de CI termina, y solo actua si la conclusion fue `success`, el evento fue un `push` y la rama fue `main`. Un fallo de tests, tipos o lint no llega nunca a produccion.

## Cabeceras de seguridad

- La web las declara en `apps/web/_headers` (CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`).
- El Worker las pone en cada respuesta desde `workers/api/src/salud.ts`. Las paginas HTML llevan su propio CSP, **sin `unsafe-inline` ni `unsafe-eval`**: por eso los estilos van en una hoja externa (`GET /panel/estilos.css`) y no en linea.

## Como se identifica el empleado

1. **La entrada** (`POST /admin/entrar`, `POST /panel/entrar`) recibe correo y contrasena, los presenta al proveedor de identidad y guarda el pasaporte en una **cookie que el navegador no puede leer** (`ADR-0024`). El navegador nunca ve el pasaporte.
2. **Se valida la firma con la clave publica de Supabase**, leida de su JWKS (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`). El proyecto firma con clave **asimetrica ES256**; el borde **no guarda ningun secreto para verificar** (`ADR-0021`). El algoritmo no lo elige el token: se comprueba contra una lista blanca (`ES256`, `RS256`). Las claves se cachean una hora en el propio Worker; si no se pueden leer, se responde **503** (no poder juzgar un pasaporte no es culpa de quien llama), nunca 401.
3. **Se resuelve la ficha del empleado** por `staff.auth_user_id`, en una transaccion corta: primero se fija `request.jwt.claims` (permite leer la propia fila por la politica `staff_select_auth`), y despues `app.*` con lo que diga la fila, para poder leer el nombre de la organizacion y del local. La transaccion importa: sin ella, el pool de Hyperdrive podria arrastrar el contexto de una peticion a la siguiente.
4. `POST /auth/sesion` (para clientes que ya traen el pasaporte) devuelve la misma ficha: `401 falta_token`, `401 token_invalido`, `403 empleado_no_vinculado`, `503 identidad_no_disponible`, `503 servicio_no_configurado`.

**Con credenciales que no valen, la respuesta es identica a la de un correo que no existe** (mismo codigo y mismo mensaje): la pantalla no sirve para averiguar quien tiene cuenta.

## Como conecta el borde con la base

Por **Hyperdrive**, sin cache, y con la conexion **directa** a Supabase (`db.<referencia>.supabase.co`), porque Hyperdrive vive dentro de Cloudflare y Cloudflare si tiene IPv6.

**Cuatro capas, y las cuatro costaron:**

1. **La conexion directa de Supabase es solo IPv6.** Los runners de GitHub no tienen IPv6: para todo lo que corra en CI se usa el **Session pooler** (IPv4, puerto **5432**, no el 6543 de transaccion), con el usuario en la forma `postgres.<referencia>`. El borde no lo necesita, porque sale por Hyperdrive; pero `pg_dump` si, y funciona por ahi con `PGSSLMODE=verify-full`.
2. **Supabase firma con una raiz propia** (`Supabase Root 2021 CA`). La forma correcta es **confiar en esa CA** (esta en `packages/db/certs/prod-ca-2021.crt`), nunca desactivar la verificacion del certificado. Caduca el **2031-04-26**; si Supabase la rota, hay que actualizar el fichero. **El Worker no puede comprobar esa CA por conexion directa** (workerd ignora esa opcion a proposito), de modo que Hyperdrive no es una comodidad: es la **unica via** de conectar el borde con `verify-full`.
3. **La contrasena nunca va dentro de la URL.** Un caracter como `#`, `@`, `%` o `:` sin codificar la corta en silencio. Va en secreto aparte.
4. **El usuario del pooler puede llevar punto** (`postgres.<referencia>`) y **no es un rol real**: no se puede interpolar en `alter default privileges`.

**El tunel.** Se crea y se actualiza con el workflow **"Configurar tunel"** (`.github/workflows/configurar-tunel.yml`, lanzado a mano), que sube la CA de Supabase a Cloudflare como certificado de autoridad y crea el Hyperdrive en modo `verify-full`, sin cache. Identificadores (no son secretos): certificado de autoridad `ab39faff-4bb6-43c2-8b62-2ec7a8960425`, tunel `8d17257eef554341870f06bcfc93376a`. El enlace se declara en `workers/api/wrangler.jsonc` como binding `BASE`.

**Roles.** En Supabase no se crea ningun superusuario: el administrador ya existe (`postgres`, que tiene BYPASSRLS). Se asegura `camarero_app`, que **no tiene BYPASSRLS y no es propietario de nada**, y se **revocan los permisos por defecto** que Supabase concede a `anon`, `authenticated` y `service_role` sobre `public` (este ultimo tambien tiene BYPASSRLS: si conservara acceso y su clave se filtrara, el aislamiento desapareceria).

**Historial de migraciones.** `public.camarero_migraciones` anota lo aplicado, con **linea base** automatica si la base ya tenia esquema. Sin el, una segunda ejecucion intentaria crear tablas existentes. El Postgres local de los tests no lo usa: siempre parte de cero.

**Por que el historial se queda en `public`.** No es comodidad, es estado: moverlo a un esquema propio dejaria la linea base **vacia** en una base ya instalada, y esta marcaria la migracion de limpieza como aplicada **sin ejecutarla**, dejando `prueba_runner` en produccion. Como `public` es el esquema que Supabase expone a su API, la proteccion se resuelve con permisos: el aprovisionamiento retira a `anon`, `authenticated` y `service_role` el uso del esquema y todos los privilegios sobre sus tablas, **incluidos los privilegios por defecto** (asi una reinstalacion tampoco los expone). La prueba `packages/db/tests/historial.test.ts` lo demuestra concediendo primero el acceso (para que la prueba no sea vacua) y leyendo despues **de verdad** como cada uno de los tres roles: los tres fallan.

**`prueba_runner` ya no forma parte del esquema.** Nacio en la migracion `0001` solo para confirmar que el runner aplicaba migraciones en orden, y viajo a produccion sin querer. La retira la migracion `0016_quitar_tabla_de_pruebas.sql` (`drop table if exists public.prueba_runner`), y las pruebas del runner se crean su propia tabla en `packages/db/tests/runner.test.ts`. Aplicar el esquema desde cero ya no la crea.

**El borde nunca conecta como `postgres`.** En Supabase ese rol ignora la RLS. El borde conecta como `camarero_app`, que si esta sujeto a ella.

## Operacion: copias de seguridad y restauracion

### Donde viven las copias

- Bucket R2 **`camarero-copias`**, prefijo `copias/`.
- Semanales: `copias/semanal/AAAA-MM-DD.sql.age` (se conservan las **4** mas recientes).
- Mensuales: `copias/mensual/AAAA-MM.sql.age` (se conserva la mas reciente; se crea en la primera copia de cada mes).
- `copias/indice.json` es el manifiesto interno: dice que hay y que se conserva. No es una copia.
- El flujo **"Copias de seguridad"** (`.github/workflows/copias.yml`) corre los domingos y a mano. Volca **`public` Y `auth`** con `pg_dump --format=custom`, lo cifra con `age`, lo sube y **ensaya la restauracion** en un PostgreSQL 17 limpio. Si el ensayo no cuadra, el flujo **se pone rojo**.

**Por que `auth` es obligatorio en la copia:** si la copia no llevara `auth`, un restore devolveria el sistema **sin ninguna cuenta de acceso** y no habria forma de entrar. Seria un agujero silencioso.

### La clave de cifrado

- Publica (para cifrar): `age1l63htk3rnppr06u462cpc8wkpfclv6n2j9640ywzzshy5xqt7u8suapr3h` — secreto `AGE_PUBLIC_KEY`. Es publica de verdad: sirve para cifrar, no para descifrar.
- Privada (para descifrar): secreto `AGE_PRIVATE_KEY` **y una copia fuera del repositorio**, en la maquina del mantenedor. **Es lo unico que abre las copias.** Debe vivir en un gestor de contrasenas o un pendrive, nunca en el repositorio ni en la memoria.

**Comprobado que el cifrado sirve:** sobre el objeto descargado de R2, `file` dice `age encrypted file, X25519 recipient` (no SQL), `strings` **no** encuentra el nombre de ningun local, y `pg_restore --list` falla. Con la clave, el SQL plano revela los datos. Es decir: **si el bucket se filtra, no se filtra nada.**

### Descifrar una copia

```
age --decrypt --identity <clave-privada> --output copia.sql copias/semanal/AAAA-MM-DD.sql.age
```

### Restaurar (procedimiento ENSAYADO: PostgreSQL 17 limpio)

1. Levantar un PostgreSQL 17 limpio.
2. Descifrar la copia y restaurarla:
   ```
   createdb restaurada
   psql -d restaurada -c 'drop schema if exists public cascade;'
   pg_restore --no-owner --no-privileges --exit-on-error --dbname=restaurada copia.sql
   ```
   (`public` ya existe en un PostgreSQL recien creado; el volcado lo recrea, por eso se retira antes.)
3. Comprobar: mismo numero de tablas en `public` que el origen; mismas filas en `orgs`, `locations`, `staff` y `auth.users`. En el restaurado, la aplicacion sin contexto debe ver **0 filas**. Esto lo ejecuta el propio flujo.

### Restaurar en un proyecto de Supabase NUEVO — **NO ENSAYADO**

El ensayo anterior es un PostgreSQL limpio. Un proyecto Supabase nuevo **ya trae el esquema `auth` de la plataforma**, asi que restaurar el archivo entero colisiona. Pasos propuestos, **a validar antes de fiarse**:

1. Crear el proyecto.
2. Apuntar todo al proyecto nuevo: `CAMARERO_DB_URL_ADMIN`, `CAMARERO_DB_PASSWORD_ADMIN`, `CAMARERO_DB_PASSWORD_APP` (GitHub); `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Cloudflare); y **recrear el tunel** con el flujo "Configurar tunel".
3. `drop schema public cascade;` como administrador y restaurar **solo `public`** desde la copia.
4. Para `auth`: restaurar **solo datos** sobre el esquema `auth` propio del proyecto (`--data-only`), o usar las herramientas de Supabase. **Este paso no se ha ensayado.**
5. Ejecutar **"Instalar esquema"** para recrear el rol y los permisos.
6. Repetir las comprobaciones del apartado anterior.

### Recuperacion de la contrasena de `camarero_app` (`RISK-020`)

Las contrasenas de roles propios **no viajan en las copias** (`pg_dump` no vuelca roles). Tras un restore, o tras **despausar** el plan gratuito por inactividad (`RISK-001`), `camarero_app` queda sin contrasena y el borde falla al autenticarse. Recuperacion: lanzar el flujo **"Instalar esquema"**, que repone la contrasena desde el secreto `CAMARERO_DB_PASSWORD_APP` y vuelve a conceder permisos (las migraciones ya aplicadas se saltan porque `public.camarero_migraciones` las registra).

### El keep-alive (`RISK-001`)

El borde lleva un **cron diario** (`0 12 * * *`) con **dos sondeos independientes**: una consulta real a Postgres por Hyperdrive (`select 1`) y una llamada a **`GET /auth/v1/health` con la clave publishable**, para que el proyecto no se pause por inactividad. Cada sondeo exige una **respuesta concreta** —un 2xx del endpoint elegido—: un 401 o un 404 son **fallos**, nunca exitos, y un fallo de uno no tumba el cron ni impide el otro. El endpoint raiz de PostgREST (`/rest/v1/`) **no sirve** para esto: exige una clave secreta que por diseno no tenemos y devolvia un 401 permanente que el codigo contaba como exito (`LL-019`). Vive en **Cloudflare** y no en GitHub a proposito (`ADR-0026`): GitHub **desactiva los flujos programados tras 60 dias sin actividad en el repositorio**, y este repositorio puede pasar semanas quieto. Si el cron de GitHub se desactivara, se perderia la **copia**, no la vida del proyecto. Es una mitigacion, no una garantia: si Cloudflare no ejecuta el cron, el proyecto se pausa igual.

## Secretos

| Nombre | Donde | Que es |
|--------|-------|--------|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub | Publicar en Cloudflare y gestionar R2 |
| `CAMARERO_DB_URL_ADMIN` | GitHub | Pooler, usuario de administracion, **sin contrasena** |
| `CAMARERO_DB_PASSWORD_ADMIN` | GitHub | Contrasena del administrador |
| `CAMARERO_DB_PASSWORD_APP` | GitHub | Contrasena del rol de la aplicacion |
| `SUPABASE_URL` | Cloudflare | URL del proyecto; sirve para leer el JWKS |
| `SUPABASE_ANON_KEY` | Cloudflare (+ GitHub, para instalarla) | Clave **publishable**: **publica por diseno**. Sirve para presentar credenciales al proveedor, no para verificar pasaportes. |
| `AGE_PUBLIC_KEY` | GitHub | Clave publica de cifrado de las copias |
| `AGE_PRIVATE_KEY` | GitHub + fuera del repositorio | **Lo unico que abre las copias.** Si se pierde, las copias no sirven. |
| `SUPABASE_SERVICE_ROLE_KEY` | No se usa | **Salta la RLS.** No esta en ningun sitio y no debe estarlo. |

Ningun secreto vive en el repositorio, y ninguno se pega en conversaciones. La clave publishable es la **unica excepcion explicita**: no es un secreto (esta disenada para ir en el navegador), pero **se confunde con facilidad con la clave de servicio**, que es la llave maestra. Ante la duda, no se copia nada.

**Para verificar** un pasaporte el borde **no guarda ningun secreto**: solo la clave publica del proveedor. Tuvo `SUPABASE_JWT_SECRET` (verificacion simetrica HS256) y se **retiro** del Worker el 2026-09-30, al pasar a verificacion asimetrica por JWKS (`ADR-0021`, `LL-016`).

## Por que el subdominio es neutro

El nombre definitivo del producto esta pendiente. Se usa `camarero` como subdominio neutro, igual que el slug del repositorio. Y el QR se imprime apuntando a este dominio controlado por el proyecto, de modo que no se apague nunca aunque cambie de proveedor (la leccion de GloriaFood, `D-038`).

## Lo que NO hace el borde

- No cobra: el dinero nunca pasa por aqui.
- No guarda datos personales del comensal.
- No habla con el TPV: la integracion es opcional y posterior (`D-038`).
