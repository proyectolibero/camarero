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
related:
  - ADR-0002
  - ADR-0018
  - ADR-0019
  - ADR-0020
  - ADR-0021
  - ADR-0023
  - ADR-0024
  - TASK-F0-03
  - TASK-F0-04
  - TASK-F0-08
  - TASK-F0-09
  - LL-014
  - LL-016
  - CONTRACT-pantallas
  - RISK-001
  - RISK-020
---

## Que es el borde

El borde es todo lo que hay entre el comensal y la base de datos: la web, la API de
Cloudflare y el almacen de imagenes. Un solo proveedor (Cloudflare) y un solo dominio
global (D-023). Ver `ADR-0002`, `ADR-0018`, `ADR-0020` y `CONTRACT-pantallas`.

## Las tres piezas

| Pieza | Donde | Que hace |
|-------|-------|----------|
| **Web** | Cloudflare Pages, carpeta `apps/web` | Sirve la PWA del comensal (de momento, una pagina vacia). |
| **API** | Cloudflare Worker, `workers/api` | Expone `GET /health`, `POST /auth/sesion` y **los paneles del dueno (`/admin`) y de plataforma (`/panel`)**, que se dibujan en el servidor (`ADR-0023`). |
| **Carta** | Cloudflare R2, bucket `camarero-cartas` | Guarda las imagenes de la carta. 10 GB gratis. |

## Regla de despliegue

**Produccion solo se publica desde `main` y solo despues de que CI pase.** Esta en
`.github/workflows/deploy.yml`: se dispara cuando el workflow de CI termina, y solo actua
si la conclusion fue `success`, el evento fue un `push` y la rama fue `main`. Un fallo de
tests, tipos o lint no llega nunca a produccion.

## Cabeceras de seguridad

- La web las declara en `apps/web/_headers` (CSP, HSTS, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options`).
- El Worker las pone en cada respuesta desde `workers/api/src/salud.ts`. Las paginas HTML
  llevan su propio CSP, **sin `unsafe-inline` ni `unsafe-eval`**: por eso los estilos van
  en una hoja externa (`GET /panel/estilos.css`) y no en linea.

## Como se identifica el empleado

1. **La entrada** (`POST /admin/entrar`, `POST /panel/entrar`) recibe correo y contrasena,
   los presenta al proveedor de identidad y guarda el pasaporte en una **cookie que el
   navegador no puede leer** (`ADR-0024`). El navegador nunca ve el pasaporte.
2. **Se valida la firma con la clave publica de Supabase**, leida de su JWKS
   (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`). El proyecto firma con clave
   **asimetrica ES256**; el borde **no guarda ningun secreto para verificar** (`ADR-0021`).
   El algoritmo no lo elige el token: se comprueba contra una lista blanca (`ES256`,
   `RS256`). Las claves se cachean una hora en el propio Worker; si no se pueden leer, se
   responde **503** (no poder juzgar un pasaporte no es culpa de quien llama), nunca 401.
3. **Se resuelve la ficha del empleado** por `staff.auth_user_id`, en una transaccion
   corta: primero se fija `request.jwt.claims` (permite leer la propia fila por la politica
   `staff_select_auth`), y despues `app.*` con lo que diga la fila, para poder leer el
   nombre de la organizacion y del local. La transaccion importa: sin ella, el pool de
   Hyperdrive podria arrastrar el contexto de una peticion a la siguiente.
4. `POST /auth/sesion` (para clientes que ya traen el pasaporte) devuelve la misma ficha:
   `401 falta_token`, `401 token_invalido`, `403 empleado_no_vinculado`,
   `503 identidad_no_disponible`, `503 servicio_no_configurado`.

**Con credenciales que no valen, la respuesta es identica a la de un correo que no existe**
(mismo codigo y mismo mensaje): la pantalla no sirve para averiguar quien tiene cuenta.

## Como conecta el borde con la base

Por **Hyperdrive**, sin cache, y con la conexion **directa** a Supabase
(`db.<referencia>.supabase.co`), porque Hyperdrive vive dentro de Cloudflare y Cloudflare
si tiene IPv6.

**Cuatro capas, y las cuatro costaron:**

1. **La conexion directa de Supabase es solo IPv6.** Los runners de GitHub no tienen IPv6:
   para todo lo que corra en CI se usa el **Session pooler** (IPv4, puerto **5432**, no el
   6543 de transaccion), con el usuario en la forma `postgres.<referencia>`. El borde no lo
   necesita, porque sale por Hyperdrive.
2. **Supabase firma con una raiz propia** (`Supabase Root 2021 CA`). La forma correcta es
   **confiar en esa CA** (esta en `packages/db/certs/prod-ca-2021.crt`), nunca desactivar la
   verificacion del certificado. Caduca el **2031-04-26**; si Supabase la rota, hay que
   actualizar el fichero. **El Worker no puede comprobar esa CA por conexion directa**
   (workerd ignora esa opcion a proposito), de modo que Hyperdrive no es una comodidad:
   es la **unica via** de conectar el borde con `verify-full`.
3. **La contrasena nunca va dentro de la URL.** Un caracter como `#`, `@`, `%` o `:` sin
   codificar la corta en silencio. Va en secreto aparte.
4. **El usuario del pooler puede llevar punto** (`postgres.<referencia>`) y **no es un rol
   real**: no se puede interpolar en `alter default privileges`.

**El tunel.** Se crea y se actualiza con el workflow **"Configurar tunel"**
(`.github/workflows/configurar-tunel.yml`, lanzado a mano), que sube la CA de Supabase a
Cloudflare como certificado de autoridad y crea el Hyperdrive en modo `verify-full`, sin
cache. Identificadores (no son secretos): certificado de autoridad
`ab39faff-4bb6-43c2-8b62-2ec7a8960425`, tunel `8d17257eef554341870f06bcfc93376a`. El enlace
se declara en `workers/api/wrangler.jsonc` como binding `BASE`.

**Roles.** En Supabase no se crea ningun superusuario: el administrador ya existe
(`postgres`, que tiene BYPASSRLS). Se asegura `camarero_app`, que **no tiene BYPASSRLS y no
es propietario de nada**, y se **revocan los permisos por defecto** que Supabase concede a
`anon`, `authenticated` y `service_role` sobre `public` (este ultimo tambien tiene
BYPASSRLS: si conservara acceso y su clave se filtrara, el aislamiento desapareceria).

**Historial de migraciones.** `public.camarero_migraciones` anota lo aplicado, con **linea
base** automatica si la base ya tenia esquema. Sin el, una segunda ejecucion intentaria
crear tablas existentes. El Postgres local de los tests no lo usa: siempre parte de cero.

**El borde nunca conecta como `postgres`.** En Supabase ese rol ignora la RLS. El borde
conecta como `camarero_app`, que si esta sujeto a ella.

## Operacion: recuperacion de la contrasena del rol

Las contrasenas de roles propios **no se guardan en las copias de seguridad**. Tras un
*restore*, o tras **despausar** un proyecto del plan gratuito por inactividad (`RISK-001`),
la contrasena de `camarero_app` queda vacia y la conexion del borde falla con error de
autenticacion. Paso de recuperacion: volver a lanzar **"Instalar esquema"**, que repone la
contrasena desde el secreto `CAMARERO_DB_PASSWORD_APP` (`RISK-020`).

## Secretos

| Nombre | Donde | Que es |
|--------|-------|--------|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub | Publicar en Cloudflare |
| `CAMARERO_DB_URL_ADMIN` | GitHub | Pooler, usuario de administracion, **sin contrasena** |
| `CAMARERO_DB_PASSWORD_ADMIN` | GitHub | Contrasena del administrador |
| `CAMARERO_DB_PASSWORD_APP` | GitHub | Contrasena del rol de la aplicacion |
| `SUPABASE_URL` | Cloudflare | URL del proyecto; sirve para leer el JWKS |
| `SUPABASE_ANON_KEY` | Cloudflare (+ GitHub, para instalarla) | Clave **publishable**: **publica por diseno**, la misma que lleva el navegador de cualquier cliente. Sirve para presentar credenciales al proveedor de identidad, no para verificar pasaportes. |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare | Solo si hiciera falta; **salta la RLS**, nunca en el cliente |

Ningun secreto vive en el repositorio, y ninguno se pega en conversaciones. La clave
publishable es la **unica excepcion explicita**: no es un secreto (esta disenada para ir en
el navegador), pero **se confunde con facilidad con la clave de servicio**, que es la llave
maestra. Ante la duda, no se copia nada.

**Para verificar** un pasaporte el borde **no guarda ningun secreto**: solo la clave
publica del proveedor. Tuvo `SUPABASE_JWT_SECRET` (verificacion simetrica HS256) y se
**retiro** del Worker el 2026-09-30, al pasar a verificacion asimetrica por JWKS
(`ADR-0021`, `LL-016`). La clave publishable no verifica nada: solo abre la puerta del
proveedor para presentar credenciales.

## Por que el subdominio es neutro

El nombre definitivo del producto esta pendiente. Se usa `camarero` como subdominio neutro,
igual que el slug del repositorio. Y el QR se imprime apuntando a este dominio controlado
por el proyecto, de modo que no se apague nunca aunque cambie de proveedor (la leccion de
GloriaFood, `D-038`).

## Lo que NO hace el borde

- No cobra: el dinero nunca pasa por aqui.
- No guarda datos personales del comensal.
- No habla con el TPV: la integracion es opcional y posterior (`D-038`).
