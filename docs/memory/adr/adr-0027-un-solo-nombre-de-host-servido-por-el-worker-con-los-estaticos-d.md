---
id: ADR-0027
type: adr
title: Un solo nombre de host servido por el Worker con los estaticos dentro; el proyecto de Pages se retira
status: accepted
date: 2026-09-30
tags:
  - infraestructura
  - borde
  - cloudflare
  - dominio
  - arquitectura
related:
  - ADR-0018
  - ADR-0022
  - ADR-0023
  - ADR-0024
  - ADR-0026
  - D-023
  - TASK-F0-03
  - CONTRACT-borde
  - CONTRACT-pantallas
---

## Contexto

D-023 y ADR-0022 piden un solo dominio global, y las cuatro superficies estan definidas por ruta (/t/..., /staff, /admin, /panel). La investigacion de Cloudflare dio un hecho que obliga a decidir: NO se puede poner un dominio personalizado de Pages en un host que ya tenga una ruta de Worker, y Pages tampoco admite rutas que no sean la raiz. Es decir, Pages y Worker no pueden compartir nombre de host. Y el token de despliegue NO tiene permiso de DNS, asi que la conexion del dominio la tendra que hacer el humano.

## Decision

El producto vive en UN SOLO nombre de host, y lo sirve el Worker: los ficheros estaticos (la PWA del comensal y, mas adelante, la del personal) van dentro del propio Worker con el binding de recursos estaticos, y las rutas dinamicas (/admin, /panel, /auth/*, /health) las atiende el codigo. El proyecto de Pages se retira.

## Alternativas consideradas

1) Dos nombres de host (Pages en camarero.proyectolibero.org y el Worker en otro). Descartado por tres motivos reales, no teóricos: obliga a CORS entre el cliente y la API; obliga a que la cookie de sesion lleve Domain compartido, lo que la envia a TODOS los subdominios del dominio (mas debil que la cookie de host unico que hay hoy); y acopla el certificado y el despliegue a dos nombres, contradiciendo D-023 y ADR-0022.
2) Pages sirviendo unas rutas y el Worker otras en el mismo host. Descartado porque NO ESTA SOPORTADO: la documentacion oficial de Pages lo dice explicitamente ("not possible to add a custom domain with a Worker already routed on that domain"), y Pages ademas no admite rutas que no sean la raiz.
3) Meter la API dentro de Pages con Pages Functions. Descartado: seguiria atado a Pages, que es justo lo que bloquea el host unico, y duplicaria en otro sitio la logica de autenticacion y de base que ya vive en el Worker (ADR-0023).

## Consecuencias

Se gana: una sola direccion para las cuatro superficies; el QR se imprime una vez y no cambia nunca; sin CORS; la cookie de sesion se queda como cookie de host unico, que es mas segura que compartirla por Domain; un solo despliegue; y los estaticos salen gratis e ilimitados. Se pierde: las vistas previas y la comodidad de Pages, y el Worker pasa a ser el unico punto que sirve todo (si el Worker falla, falla tambien la web). Mitigacion de lo segundo: los estaticos los sirve la plataforma de Cloudflare sin invocar el Worker, de modo que una web estatica sigue viva aunque el codigo del Worker tenga un fallo. Límites comprobados: 20000 ficheros y 25 MiB por fichero, de sobra para una PWA.
