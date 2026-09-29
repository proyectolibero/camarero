---
id: CONTRACT-borde
type: contract
title: "CONTRACT-borde — El borde de Cloudflare: Pages, Workers y R2"
status: active
date: 2026-09-28
tags:
  - borde
  - infraestructura
  - cloudflare
  - contrato
related:
  - ADR-0002
  - ADR-0018
  - TASK-F0-03
  - D-023
  - D-031
  - D-038
---

## Que es el borde

El borde es todo lo que hay entre el comensal y la base de datos: la web, la API de
Cloudflare y el almacen de imagenes. Un solo proveedor (Cloudflare) y un solo dominio
global (D-023). Ver `ADR-0002` y `ADR-0018`.

## Las tres piezas

| Pieza | Donde | Que hace |
|-------|-------|----------|
| **Web** | Cloudflare Pages, carpeta `apps/web` | Sirve la PWA (de momento, una pagina vacia). |
| **API** | Cloudflare Worker, `workers/api` | Expone `/health`; mas adelante, web push, cron y rate limit. |
| **Carta** | Cloudflare R2, bucket `camarero-cartas` | Guarda las imagenes de la carta. 10 GB gratis. |

## Regla de despliegue

**Produccion solo se publica desde `main` y solo despues de que CI pase.** Esta en
`.github/workflows/deploy.yml`: se dispara cuando el workflow de CI termina, y solo actua
si la conclusion fue `success`, el evento fue un `push` y la rama fue `main`. Un fallo de
tests, tipos o lint no llega nunca a produccion. Es deliberado que el despliegue no viva
dentro del propio workflow de CI: asi no puede publicarse sin que el otro haya pasado.

## Cabeceras de seguridad

- La web las declara en `apps/web/_headers` (CSP, HSTS, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options`).
- El Worker las pone en cada respuesta desde `workers/api/src/salud.ts` (`cabecerasDeSeguridad`).

## Pasos de puesta en marcha (una sola vez, requieren cuenta de Cloudflare)

Estos pasos **no se pueden automatizar** porque necesitan la cuenta del mantenedor:

1. **Crear el bucket R2.** `wrangler r2 bucket create camarero-cartas`, o desde el panel.
   Hasta que exista, el despliegue del Worker falla porque declara el binding `CARTAS`.
2. **Crear un token de API de Cloudflare con permiso minimo.** Mi perfil > Tokens de API >
   Crear token > Personalizado, con permisos de cuenta:
   - `Workers Scripts: Edit` (publicar el Worker)
   - `Cloudflare Pages: Edit` (publicar la web)
   - `Workers R2 Storage: Edit` (usar el bucket)
   Acotado a la cuenta del proyecto. **Nunca** un token global de toda la cuenta.
3. **Guardar dos secretos en GitHub** (Settings > Secrets and variables > Actions):
   - `CLOUDFLARE_API_TOKEN` — el token del paso 2.
   - `CLOUDFLARE_ACCOUNT_ID` — el identificador de la cuenta (aparece en el panel de
     Workers y Pages).
4. **Conectar el dominio global.** `camarero.proyectolibero.org` para la web y
   `camarero-api.proyectolibero.org` para la API, ambas subdominios del dominio que ya
   existe (`ADR-0002`). La web se conecta en Pages > dominio personalizado; la API, con
   una ruta en `wrangler.jsonc`.

## Por que el subdominio es neutro

El nombre definitivo del producto esta pendiente. Se usa `camarero` como subdominio neutro,
igual que el slug del repositorio, para no tener que reimprimir nada si el nombre cambia.
Y el QR se imprime apuntando a este dominio controlado por el proyecto, de modo que no se
apague nunca aunque cambie de proveedor (la leccion de GloriaFood, `D-038`).

## Lo que NO hace el borde

- No cobra: el dinero nunca pasa por aqui.
- No guarda datos personales del comensal.
- No habla con el TPV: la integracion es opcional y posterior (`D-038`).
