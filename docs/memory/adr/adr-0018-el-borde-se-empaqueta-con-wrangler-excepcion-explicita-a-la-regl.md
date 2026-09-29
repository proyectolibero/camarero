---
id: ADR-0018
type: adr
title: "El borde se empaqueta con wrangler: excepcion explicita a la regla de no-build"
status: accepted
date: 2026-09-28
tags:
  - infraestructura
  - borde
  - typescript
  - fase-0
related:
  - ADR-0001
  - ADR-0002
  - D-021
  - CONTRACT-borde
---

## Contexto

ADR-0001 y D-021 fijaron TypeScript de punta a punta con Node 22 y type stripping nativo, es decir, sin paso de build. Al levantar el borde de Cloudflare (ADR-0002) aparece una tension: los Workers de Cloudflare no ejecutan TypeScript, ejecutan JavaScript empaquetado. La herramienta oficial, wrangler, toma el TypeScript y lo empaqueta. El empaquetado no es opcional ni evitable dentro de Cloudflare.

## Decision

El codigo del borde se escribe en TypeScript estricto y se empaqueta con wrangler, que es la herramienta de la plataforma. El empaquetado se acepta como caracteristica inherente de Cloudflare Workers, no como un paso de build del proyecto. El resto del monorepo sigue ejecutandose sin build, con type stripping nativo.

## Alternativas consideradas

(A) Escribir el Worker en JavaScript plano, sin TypeScript, para no empaquetar. Descartada: renuncia al tipado estricto justo en el codigo que atiende internet, y contradice D-021. (B) Usar una plataforma que ejecute TypeScript directamente en el borde. Descartada: Cloudflare es lo que ADR-0002 eligio para respetar los terminos de uso comercial y mantener coste cero; cambiar de proveedor por esto seria peor negocio. (C) Renunciar al borde y servirlo todo desde Supabase. Descartada: el borde necesita hacer web push, cron y rate limit, cosas que la base no debe hacer. (D) Aceptar el empaquetado de wrangler como parte inherente de la plataforma. Elegida.

## Consecuencias

Gana: se mantiene TypeScript estricto en todo el proyecto y el codigo del borde se escribe igual que el resto, con tipos y tests con Vitest sobre funciones puras. El empaquetado es cosa de wrangler, no un pipeline propio que mantener. Pierde: la regla de 'sin paso de build' deja de ser absoluta; hay que explicar bien la excepcion para que nadie la use de excusa y meta un pipeline de build en el resto del monorepo. El artefacto que llega a produccion no es el fuente literal, sino el que empaqueta la plataforma. Se asume porque la alternativa era cambiar de proveedor o perder tipado.
