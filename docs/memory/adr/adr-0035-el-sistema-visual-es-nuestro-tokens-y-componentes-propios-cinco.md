---
id: ADR-0035
type: adr
title: "El sistema visual es nuestro: tokens y componentes propios, cinco modelos, y la identidad del local como dato"
status: accepted
date: 2026-10-02
tags:
  - diseno
  - tokens
  - temas
  - sin-dependencias
  - piloto
related:
  - ADR-0023
  - ADR-0027
  - ADR-0034
  - CONTRACT-pantallas
  - D-045
  - D-057
---

## Contexto

El humano ha fijado el rumbo (D-057): antes de buscar locales, el sistema tiene que ser atractivo y configurable. Pidio buscar un repositorio de diseno en GitHub, y la busqueda se hizo: las plantillas de restaurante son paginas de presentacion y los sistemas de diseno buenos son dependencias ajenas. Su respuesta fue tajante y correcta: «prefiero usar algo nuestro y que nosotros lo controlemos».

## Decision

El sistema visual es NUESTRO y vive en un solo sitio (`packages/ui`): tokens semanticos en variables de CSS y componentes propios, sin ninguna dependencia de terceros y sin framework. Los colores NUNCA se escriben a mano en una pantalla: se usan tokens. Encima del sistema hay CINCO MODELOS pre listos que el local elige y ajusta, y su identidad —logo, portada, color de acento y sus propias palabras— se guarda como DATO del local, no como codigo. La carta del comensal es la puerta de entrada y es donde se lleva la belleza; el panel conserva la sobriedad de un backoffice.

## Alternativas consideradas

1) Adoptar un sistema de diseno de GitHub (se buscaron: plantillas de restaurante, sistemas en CSS puro, juegos de tokens). Descartado con el motivo escrito: las plantillas de restaurante que hay son PAGINAS DE PRESENTACION (foto grande, reserva tu mesa, blog), que no resuelven nuestro problema —una carta que se usa con una mano, con mala luz y en cuatro toques—; y los sistemas de diseno buenos son dependencias que envejecen, que no controlamos, y que obligarian a reescribir nuestras pantallas para encajar en su manera de hacer las cosas. Lo dijo el humano: «prefiero usar algo nuestro y que nosotros lo controlemos».
2) Un framework de CSS utilitario con paso de compilacion. Descartado: mete una herramienta mas en la cadena y contradice ADR-0023. Ademas los nombres de sus clases acabarian en nuestro HTML generado, acoplando cada pantalla a ese framework.
3) Un solo modelo fijo y bien hecho. Descartado: dos locales distintos tienen identidades distintas, y obligar a un bar nocturno a parecerse a una cafeteria es exactamente lo contrario de la premisa del proyecto.
4) Dejar los colores en cada pantalla y cambiar los que hagan falta. Descartado: en la decima pantalla habria cinco estilos, y cambiar el color de un local seria buscar y reemplazar por todo el codigo.

## Consecuencias

Se gana: control total, cero dependencias visuales, velocidad (el CSS es pequeno y propio), y una sola fuente donde cambiar algo: los tokens. La identidad del local se vuelve un dato, no un despliegue. Se pierde: el trabajo de construirlo y de mantenerlo (componentes, dos modos y cinco modelos), que recae en el mantenedor unico. Mitigacion: empezar por lo que de verdad se usa (boton, tarjeta, insignia, formulario, aviso) y crecer solo cuando una pantalla lo pida, no antes.
