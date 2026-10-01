---
id: D-049
type: decision
title: El alta de platos y bebidas se hace desde la carta, con la foto en el mismo formulario
status: accepted
date: 2026-10-01
phase: F1
tags:
  - carta
  - bebidas
  - fotos
  - usabilidad
  - fase-1
related:
  - D-048
  - ADR-0030
  - CONTRACT-pantallas
  - TASK-F1-05
  - LL-020
---

## Decision

El alta de platos y bebidas se hace desde la pantalla de la carta, sin tener que entrar en una categoria, con la categoria elegida dentro del propio formulario. Hay un atajo para anadir bebida que deja la estacion de preparacion en barra. La foto se sube en el MISMO formulario de alta, no despues. Y toda alta ofrece guardar y anadir otro, para teclear una carta de barra sin volver a empezar cada vez.

## Justificacion

El humano probo la carta recien construida y encontro dos defectos de flujo en el primer uso: para crear un plato habia que entrar dentro de una categoria, y la foto solo se podia subir despues de crear el plato. Crear, guardar, volver a entrar, editar y subir son cinco pasos en lugar de uno. Y habia dicho dos veces que las fotos y las bebidas son lo que mas importa. La leccion de fondo: una pantalla puede estar correcta y aun asi ser inservible. Lo que falla no es el dato, es el camino hasta el.

## Alternativas

1) Dejar el alta donde estaba: entrar en la categoria, crear, guardar y subir la foto editando despues. Descartado: son cinco pasos donde debe haber uno, y el humano lo detecto al primer intento. Meter la foto en un segundo paso castiga justo lo que el mismo dijo que era mas importante.
2) Formularios separados por tipo, uno para platos y otro para bebidas. Descartado: son el mismo dato con otra estacion de preparacion. Separarlos duplica pantalla, validaciones y permisos, y obliga a mantener dos sitios cada vez que cambie un campo.
3) Importar la carta desde una hoja de calculo. Descartado por ahora: resuelve el caso de las cien referencias, pero exige definir un formato, gestionar errores fila a fila y ensenar a usar plantillas. El atajo de bebidas y el guardar y anadir otro cubren la urgencia de hoy con una decima parte del trabajo.
