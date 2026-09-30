---
id: ADR-0024
type: adr
title: La sesion del personal vive en una cookie que el navegador no puede leer
status: accepted
date: 2026-09-30
tags:
  - autenticacion
  - seguridad
  - panel
  - sesion
related:
  - ADR-0019
  - ADR-0021
  - ADR-0022
  - CONTRACT-borde
  - CONTRACT-pantallas
---

## Contexto

El personal entra con correo y contrasena, y el borde ya sabe verificar pasaportes contra la clave publica del proveedor. Falta decidir donde vive la sesion una vez dentro, porque de eso depende que un fallo de inyeccion de script pueda o no robar la cuenta.

## Decision

La sesion del personal vive en una cookie que el navegador NO puede leer (httpOnly, Secure, SameSite=Lax, Path=/). El borde hace de intermediario en la entrada: recibe correo y contrasena, los presenta al proveedor de identidad, y guarda el pasaporte resultante en la cookie. El pasaporte nunca llega al navegador.

## Alternativas consideradas

1) El pasaporte en el almacenamiento local del navegador (localStorage). Descartado: cualquier inyeccion de script lo lee y se lleva la sesion; es la forma mas comun de perder una cuenta.
2) El pasaporte en memoria, con refresco. Descartado: se pierde al recargar o al cerrar la pestana, y obliga a refrescar mas a menudo, lo que multiplica las peticiones de sesion.
3) Cookie legible por el navegador. Descartado: no aporta nada frente a la cookie opaca y reintroduce el robo por inyeccion.
4) Que el navegador hable directo con el proveedor de identidad y guarde el pasaporte el mismo. Descartado: expone el pasaporte al navegador en el momento de entrar y obliga al cliente a conocer la clave publica del proyecto, que no aporta nada aqui.

## Consecuencias

Se gana: una inyeccion de script no puede robar la sesion, porque el navegador no puede leer la cookie. Se pierde: el borde tiene que hacer de intermediario en la entrada (una peticion mas) y necesita la clave publica del proyecto como variable de entorno del Worker; ademas hay que vigilar el CSRF, que se cubre exigiendo POST para toda mutacion y con la cookie marcada como no enviable entre sitios. Nota: la cookie guarda el pasaporte, asi que su caducidad es la del pasaporte; no se inventa sesion propia.
