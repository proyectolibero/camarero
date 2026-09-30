---
id: LL-016
type: lesson
title: Se escribio el verificador del pasaporte con el algoritmo equivocado por suponer en vez de comprobar
status: recorded
date: 2026-09-30
tags:
  - autenticacion
  - supabase
  - verificacion
  - fase-0
related: []
---

## Error

Se implemento la verificacion del pasaporte de Supabase con clave simetrica compartida (HS256) dando por hecho que era el esquema del proyecto. El proyecto usa firma asimetrica ES256, asi que el inicio de sesion no habria funcionado nunca.

## Causa raiz

El esquema de secreto compartido (HS256) es el mas documentado de Supabase y parecia el seguro por defecto. No se comprobo que algoritmo emite ESTE proyecto hasta que hizo falta probar el inicio de sesion con un usuario real. La suposicion vivia implicita en el codigo, no escrita como pregunta abierta.

## Prevencion

Antes de escribir un verificador para un proveedor externo, comprobar el hecho observable que lo determina (aqui, el endpoint JWKS) en lugar de asumir el caso documentado por defecto. Y cuando una suposicion sobre un tercero condiciona el diseno, registrarla como pregunta abierta: una suposicion implicita en el codigo no se revisa, una pregunta escrita si.

## Detalle

El Worker verificaba el pasaporte con HMAC-SHA256 y un secreto compartido que ademas se habria guardado en Cloudflare. El endpoint publico de claves del proyecto devuelve una clave EC P-256 con alg ES256: el proyecto firma con clave asimetrica. El verificador habria rechazado todos los pasaportes reales, y el sintoma (401 en el login) habria parecido un problema de credenciales del usuario, no de algoritmo. Se descubrio al comprobar el JWKS antes de montar la prueba con un usuario real. Efecto secundario afortunado: al pasar a verificacion asimetrica, el secreto que asomo en el chat deja de servir para fabricar pasaportes que el borde acepte.
