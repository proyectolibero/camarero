---
id: LL-024
type: lesson
title: "Una fila visible pero no accionable: el dueno no podia aprobar el emparejamiento"
status: recorded
date: 2026-10-01
tags:
  - rls
  - emparejamiento
  - panel
  - hallazgo
  - seguridad
related: []
---

## Error

Una fila que se puede leer pero no se puede escribir: el dueno veia las solicitudes de emparejamiento y la base le negaba aprobarlas, con un mensaje generico que culpaba a la caducidad.

## Causa raiz

Dos politicas distintas de la MISMA tabla se escribieron en momentos distintos y con criterios distintos: la de lectura incluye al dueno de la organizacion (en_mi_org) y la de escritura solo al personal del local (en_mi_local), que es una lista cerrada de roles donde org_owner no esta. Nadie comparo ambas. Y el sintoma se disfrazo porque RLS no da error al denegar una escritura: afecta a cero filas, y el codigo tradujo ese cero a un mensaje generico que hablaba de caducidad.

## Prevencion

Para toda tabla que tenga a la vez una lista y una accion, una prueba que afirme que QUIEN PUEDE VER una fila puede ACCIONAR sobre ella, o que la pantalla solo ofrece la accion a quien puede. Y regla de codigo: nunca traducir «cero filas afectadas» a un mensaje generico cuando las causas se pueden distinguir; hay que decir cual fue. Anadir ademas que toda decision deje rastro, porque un intento que falla en silencio no se puede reconstruir.

## Detalle

El humano pidio emparejarse desde el telefono y al ir al panel a aprobar recibia siempre «Esa solicitud ya no esta pendiente: puede haber caducado o ser de otro local». El diagnostico midio la base y la RLS: las solicitudes seguian pendientes (nada las marcaba caducadas), la lista las mostraba, y el UPDATE afectaba a cero filas incluso con la solicitud viva. Causa: la politica de lectura de pairing_requests admite a en_mi_org (que incluye al dueno de la organizacion, el unico empleado que existe) y la de escritura solo a en_mi_local, que exige es_staff_de_local() y ese conjunto excluye org_owner. Es decir: una fila fantasma, visible pero no accionable, y el unico empleado del sistema era justo el que no podia actuar. De paso aparecieron tres cosas mas: la ventana de 90 segundos empieza al escanear el QR y no al pulsar el boton (ir del telefono al ordenador y aprobar en 90 segundos es imposible), el estado expired esta declarado pero nada lo escribe, y el fallo no deja rastro: ni decided_at, ni fila en el registro de auditoria, ni forma de reconstruir el intento.
