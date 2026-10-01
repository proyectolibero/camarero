---
id: ADR-0032
type: adr
title: Quien ve una solicitud puede decidirla; la ventana de emparejamiento empieza al pedir y dura diez minutos
status: accepted
date: 2026-10-01
tags:
  - emparejamiento
  - rls
  - permisos
  - auditoria
  - fase-1
related:
  - ADR-0017
  - ADR-0031
  - CONTRACT-protocolo-mesa
  - CONTRACT-modelo-datos
  - LL-022
  - LL-024
  - TASK-F1-06
---

## Contexto

El humano pidio emparejarse y la aprobacion fallaba siempre. El diagnostico midio la base y la RLS y encontro dos causas independientes. Primera: la politica de LECTURA de las solicitudes admite al dueno de la organizacion (en_mi_org) y la de ESCRITURA solo al personal del local (en_mi_local, una lista cerrada de roles que excluye a org_owner), asi que el unico empleado del sistema veia la solicitud y la base le negaba actuar sobre ella. Segunda: la ventana de emparejamiento duraba 90 segundos y arrancaba al escanear el QR, no al pedir, sin renovarse; ir del telefono al ordenador y aprobar en ese plazo es imposible. Ademas nada marcaba las caducadas, el fallo no dejaba rastro y un local en estado borrador abria mesas igualmente.

## Decision

QUIEN VE UNA SOLICITUD PENDIENTE PUEDE DECIDIRLA: la politica de decision toma el mismo alcance que la de lectura (plataforma, dueno de la organizacion y personal del local). La ventana de emparejamiento dura 10 MINUTOS y empieza CUANDO EL COMENSAL PIDE, no al escanear, y pedir otra vez la renueva. Una solicitud que caduca SE MARCA. Toda decision deja rastro (quien, cuando y en el registro de auditoria). Y un local que no este activo NO abre sesiones de mesa.

## Alternativas consideradas

1) Meter org_owner en la lista de es_staff_de_local(). Descartado: el dueno no es personal del local, es otra figura con otro alcance (el suyo es la organizacion entera, no una sede). Meterlo ahi le daria ademas los permisos de personal de local en todas partes.
2) Dejar la ventana en 90 segundos y pedir al comensal que se de prisa. Descartado: en un local real, escanear, leer la carta, pulsar, ir al panel, entrar y aprobar en 90 segundos es imposible, y ademas el reloj arrancaba al ESCANEAR, antes de que nadie pidiera nada.
3) Permitir aprobar a cualquiera de la organizacion. Descartado: cocina o un servidor de OTRA sede no deberian decidir sobre una mesa que no es suya; el alcance de organizacion es del dueno y del encargado, no de cualquiera.

## Consecuencias

Se gana: quien ve una solicitud pendiente puede decidirla, que es lo que cualquiera espera; la ventana es realista y empieza cuando el comensal pide; una caducada se marca en lugar de acumularse; cada decision deja rastro; y un local que no esta activo no abre mesas. Se pierde: la ventana mas larga deja solicitudes pendientes mas tiempo (a cambio, ya no se acumulan eternamente porque se marcan). Riesgo que queda vivo: sigue sin existir identificacion por dispositivo, asi que el identificador de sesion es un token al portador; se decide en F2, con el problema delante.
