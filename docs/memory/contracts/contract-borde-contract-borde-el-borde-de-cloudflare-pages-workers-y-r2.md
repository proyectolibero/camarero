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
  - ADR-0020
  - ADR-0019
  - TASK-F0-03
  - TASK-F0-04
  - TASK-F0-08
  - LL-014
  - RISK-001
  - RISK-020
---

## Que es el borde

El borde es todo lo que hay entre el comensal y la base de datos: la web, la API de
Cloudflare y el almacen de imagenes. Un solo proveedor (Cloudflare) y un solo dominio
global (D-023). Ver `ADR-0002`, `ADR-0018` y `ADR-0020`.

## Las tres piezas

| Pieza | Donde | Que hace |
|-------|-------|----------|
| **Web** | Cloudflare Pages, carpeta `apps/web` | Sirve la PWA (de momento, una pagina vacia). |
| **API** | Cloudflare Worker, `workers/api` | Expone `/health`; mas adelante, web login, push, cron y rate limit. |
| **Carta** | Cloudflare R2, bucket `camarero-cartas` | Guarda las imagenes de la carta. 10 GB gratis. |

## Regla de despliegue

**Produccion solo se publica desde `main` y solo despues de que CI pase.** Esta en
`.github/workflows/deploy.yml`: se dispara cuando el workflow de CI termina, y solo actua
si la conclusion fue `success`, el evento fue un `push` y la rama fue `main`. Un fallo de
tests, tipos o lint no llega nunca a produccion.

## Cabeceras de seguridad

- La web las declara en `apps/web/_headers` (CSP, HSTS, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options`).
- El Worker las pone en cada respuesta desde `workers/api/src/auth` y `src/salud.ts`.

## Como se aplica el esquema en Supabase

El workflow **"Instalar esquema"** (`.github/workflows/migrar.yml`, lanzado a mano) aplica
las migraciones y aprovisiona los roles. No imprime credenciales: solo el resultado.

**Tres decisiones que costaron y hay que recordar:**

1. **La conexion directa de Supabase es solo IPv6.** Los runners de GitHub no tienen IPv6.
   Para todo lo que corra en CI se usa el **Session pooler** (IPv4, puerto **5432**, no el
   6543 de transaccion), con el usuario en la forma `postgres.<referencia>`.
2. **Supabase firma con una raiz propia** (`Supabase Root 2021 CA`). La forma correcta es
   **confiar en esa CA** (esta en `packages/db/certs/prod-ca-2021.crt`), nunca desactivar la
   verificacion del certificado. Caduca el **2031-04-26**; si Supabase la rota, hay que
   actualizar el fichero.
3. **La contrasena nunca va dentro de la URL.** Un caracter como `#`, `@`, `%` o `:` sin
   codificar la corta en silencio. Va en secreto aparte.

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
| `SUPABASE_URL`, `SUPABASE_JWT_SECRET` | Cloudflare | URL del proyecto y secreto de los tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare | Solo si hiciera falta; **salta la RLS**, nunca en el cliente |

Ningun secreto vive en el repositorio, y ninguno se pega en conversaciones.

## Por que el subdominio es neutro

El nombre definitivo del producto esta pendiente. Se usa `camarero` como subdominio neutro,
igual que el slug del repositorio. Y el QR se imprime apuntando a este dominio controlado
por el proyecto, de modo que no se apague nunca aunque cambie de proveedor (la leccion de
GloriaFood, `D-038`).

## Lo que NO hace el borde

- No cobra: el dinero nunca pasa por aqui.
- No guarda datos personales del comensal.
- No habla con el TPV: la integracion es opcional y posterior (`D-038`).
