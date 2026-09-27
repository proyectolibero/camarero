---
id: ADR-0002
type: adr
title: "Cloudflare en lugar de Vercel por restriccion de uso comercial"
status: accepted
date: 2026-09-27
tags: [infraestructura, hosting]
related: []
---

## Contexto

El plan Hobby de Vercel restringe su uso a fines **personales y no lucrativos**. Este
proyecto cobra una cuota simbolica por sede a locales, por lo que es uso comercial: con
Vercel Hobby se violarian sus terminos y la cuenta quedaria expuesta a suspension. Los
limites del plan Hobby incluyen 100 GB de transferencia, 1 M de invocaciones, 4 h de CPU y
timeout de funciones.

## Decision

Usar Cloudflare en lugar de Vercel, aprovechando el mismo proveedor para DNS, frontend,
API e imagenes. El autor ya dispone de cuenta en Cloudflare y del dominio base.

| Necesidad | Eleccion gratuita y comercialmente valida |
|-----------|-------------------------------------------|
| Frontend / PWA | **Cloudflare Pages** (gratis, sin restriccion de uso) |
| API / Web Push / cron | **Cloudflare Workers** (100 k req/dia gratis) |
| Imagenes de carta | **Cloudflare R2** (10 GB gratis), no Supabase Storage (1 GB) |
| Dominio | Cloudflare DNS (ya se dispone de `proyectolibero.org`) |

## Alternativas consideradas

- **Vercel Hobby:** descartada por violar los terminos de uso comercial.
- **Vercel Pro:** descartada por coste; rompe el presupuesto de operacion cero.
- **Netlify u otro hosting con free tier:** descartada porque no aporta ventaja frente a
  Cloudflare y fragmentaria proveedores.
- **Servidor propio (VPS):** descartada por coste y carga operativa.
- **Autohospedaje por el propio local:** descartada para el servicio operado, aunque la
  licencia AGPL lo permite como opcion del cliente.

## Consecuencias

- Se respetan los terminos del proveedor y se mantiene el coste de infraestructura en cero.
- Un unico proveedor de borde para DNS, estaticos, API e imagenes.
- La API de borde queda ligada a la plataforma de Workers (runtime tipo Web), lo que hay
  que tener en cuenta al escribir codigo de borde.
