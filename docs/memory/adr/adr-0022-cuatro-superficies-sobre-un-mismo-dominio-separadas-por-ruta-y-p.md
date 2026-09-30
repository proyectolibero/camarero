---
id: ADR-0022
type: adr
title: Cuatro superficies sobre un mismo dominio, separadas por ruta y por politica de seguridad
status: accepted
date: 2026-09-30
tags:
  - panel
  - interfaz
  - arquitectura
  - superficies
related:
  - ADR-0015
  - ADR-0019
  - ADR-0023
  - ADR-0024
  - ADR-0025
  - CONTRACT-pantallas
  - D-023
---

## Contexto

El plan del proyecto define tres superficies (comensal, personal, dueno) pero no la administracion de plataforma, aunque el modelo de datos ya reserva el rol platform_admin. El humano pide ademas "un backend con control total". Hay que fijar de una vez cuantas superficies existen, donde vive cada una y que las separa, porque de eso depende todo lo demas: el CSP, los permisos y los despliegues.

## Decision

El producto tiene CUATRO superficies sobre un mismo dominio, separadas por ruta y por politica de seguridad: comensal en /t/<codigo> (publica y anonima, sin sesion), personal en /staff (con sesion, KDS y toma de comanda), dueno en /admin (con sesion, gestion de su local) y plataforma en /panel (con sesion, rol platform_admin, alcance minimo y auditado).

## Alternativas consideradas

1) Una sola aplicacion con rutas y un unico paquete de codigo. Descartado: el comensal es anonimo y publico, mientras que el panel maneja datos de negocio; mezclar ambos obliga a un CSP mas permisivo para todos y aumenta la superficie expuesta.
2) Un subdominio por superficie (comensal., personal., admin.). Descartado por ahora: multiplica certificados y configuracion, y D-023 ya fija un dominio global unico. No cierra la puerta a migrar despues; las rutas ya lo permitirian.
3) Una aplicacion nativa. Fuera de alcance por el roadmap y por el presupuesto.

## Consecuencias

Se gana: cada superficie tiene su politica de seguridad y sus permisos, y una fuga en el comensal no alcanza al panel. Se pierde: hay mas de una cosa que desplegar y que vigilar. Mitigacion: la piel es compartida, no la logica.
