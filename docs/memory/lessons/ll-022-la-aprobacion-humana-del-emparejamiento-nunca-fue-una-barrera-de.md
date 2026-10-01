---
id: LL-022
type: lesson
title: La aprobacion humana del emparejamiento nunca fue una barrera de base, solo un acuerdo de pantalla
status: recorded
date: 2026-10-01
tags:
  - seguridad
  - rls
  - comensal
  - contrato
  - hallazgo
related: []
---

## Error

Se documento como invariante que la comanda exige aprobacion humana del emparejamiento, y la base no lo comprueba: la aprobacion es hoy solo un acuerdo de interfaz.

## Causa raiz

El contrato se escribio como diseño, por delante de la implementacion, y nadie lo volvio a confrontar con el esquema hasta hoy. Y fallo la regla que el propio proyecto ya habia aprendido para la RLS (cada invariante con su prueba): el de la aprobacion humana no tenia ninguna. Una promesa escrita en un contrato no es una barrera; una barrera es una restriccion en la base con una prueba que demuestre que sin cumplirla no se pasa.

## Prevencion

Todo invariante que un contrato afirme tiene que tener su prueba ejecutada, igual que se hizo con la regla de cero ciclos y con los importes. Y cuando un contrato se escriba POR DELANTE de la implementacion, hay que marcarlo como no implementado y crear la tarea que lo cierre, en lugar de dejarlo sonar a hecho. Proximo paso obligado: convertir la aprobacion en una barrera de base (que la comanda exija sesion aprobada) y probarlo intentando pedir sin aprobacion, que debe fallar.

## Detalle

Investigando el camino del comensal anonimo aparecieron dos cosas graves. Primera: el camino NO existe. El comensal no puede resolver el codigo de su mesa (ninguna politica se lo permite), no puede crear su sesion de mesa (la politica de insercion exige personal o plataforma), y sin sesion no hay contexto, y sin contexto no hay carta: un problema del huevo y la gallina que la migracion 0015 resolvio para el personal (con dos cerraduras minimas) pero que para el comensal no se hizo nunca. Segunda, y mas grave: LA APROBACION HUMANA NO ES UNA BARRERA. La funcion que autoriza crear una comanda (puede_crear_orden) comprueba que haya sesion y que coincidan organizacion, local y sesion, pero NO mira el estado de la sesion ni si existe una solicitud de emparejamiento aprobada. Es decir: quien tenga el identificador de sesion puede pedir aunque nadie haya aprobado nada. El emparejamiento con aprobacion humana es la promesa central del producto (esta en la descripcion raiz, en D-008 y en CONTRACT-protocolo-mesa) y hoy es un acuerdo de pantalla, no un invariante de la base.
