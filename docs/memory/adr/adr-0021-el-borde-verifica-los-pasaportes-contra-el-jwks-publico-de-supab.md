---
id: ADR-0021
type: adr
title: El borde verifica los pasaportes contra el JWKS publico de Supabase, no con un secreto compartido
status: accepted
date: 2026-09-30
tags:
  - autenticacion
  - seguridad
  - borde
  - fase-0
related:
  - ADR-0019
  - CONTRACT-borde
---

## Contexto

El borde verifica el pasaporte que emite Supabase Auth. Se implemento la verificacion con secreto compartido (HS256), que es el enfoque clasico documentado. La comprobacion del endpoint de claves publicas de este proyecto revelo que publica una clave EC P-256 con algoritmo ES256: Supabase firma con clave ASIMETRICA. Es decir, el verificador habria rechazado todos los pasaportes reales y el inicio de sesion no habria funcionado nunca. Se descubrio antes de probarlo con un usuario real, por comprobar de frente el endpoint de claves en lugar de suponer.

## Decision

El borde verifica la firma del pasaporte con la clave PUBLICA que Supabase publica en su JWKS, con lista blanca de algoritmos (ES256/RS256) y cache corta, y no guarda ningun secreto para validar identidades.

## Alternativas consideradas

1) Verificar la firma con un secreto compartido (HS256). Es el enfoque clasico de Supabase y era lo implementado. Descartado: el proyecto emite tokens firmados con clave asimetrica, asi que este verificador habria rechazado TODOS los pasaportes reales; y obliga a que el borde guarde un secreto que, si se filtra, permite fabricar pasaportes validos. Resulto ser ademas el caso real: el secreto asomo en un chat, y con HS256 ese descuido habria sido grave.
2) Delegar la validacion en Supabase (llamar a GET /auth/v1/user con el token y creer la respuesta). Descartado: anade una llamada de red en cada peticion, depende de que el servicio de autenticacion este disponible, y exige que el borde guarde otra credencial (la clave anon).
3) Aceptar el algoritmo que declare el propio token. Descartado de plano: quien ataca elegiria el algoritmo y podria pedir `none` o un simetrico.

## Consecuencias

Se gana: el borde no guarda NINGUN secreto para validar identidades, solo la clave publica, que no sirve para falsificar nada; un secreto filtrado deja de ser peligroso para el borde; menos codigo y mas simple de razonar. Se pierde: se depende del endpoint de claves de Supabase para validar (mitigado con cache de una hora y con un 503 explicito si no se puede leer, en lugar de rechazar pasaportes validos), y hay que soportar la rotacion de claves, que se resuelve sola porque el token trae el identificador de la clave con la que fue firmado.
