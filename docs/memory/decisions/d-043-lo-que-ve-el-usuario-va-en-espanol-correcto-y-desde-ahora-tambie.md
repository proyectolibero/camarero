---
id: D-043
type: decision
title: Lo que ve el usuario va en español correcto, y desde ahora también el código y la memoria nuevos
status: accepted
date: 2026-09-30
phase: F0
tags:
  - interfaz
  - proceso
  - ortografia
  - panel
related:
  - LL-006
  - CONTRACT-pantallas
  - TASK-F0-09
---

## Decision

Todo texto nuevo del proyecto se escribe en español correcto: lo que ve el usuario (obligatorio, empezando por la pantalla de entrada), los comentarios del código y los documentos nuevos de la memoria. Identificadores, rutas y nombres de ficheros siguen sin tildes (por seguridad). Los documentos ya escritos no se reescriben.

## Justificacion

El humano miró la pantalla de entrada y respondió «en español». Tenía razón: decía «Contrasena», sin eñe y sin tilde, porque la convención de escribir sin tildes (heredada de evitar problemas de codificación) se coló hasta lo que ve el cliente. Un producto en español con faltas de ortografía en su primera pantalla transmite lo contrario de lo que el proyecto promete: rigor.

## Alternativas

1) Seguir escribiendo todo sin tildes, «estilo ASCII», por seguridad de codificación. Descartado: el producto se vende a hosteleros chilenos y la pantalla de entrada decía «Contrasena». Eso no es un detalle de estilo, es una falta de respeto a quien lo va a usar, y el UTF-8 ya está declarado en el HTML. El problema nunca fue la tilde: fue un `Set-Content` de PowerShell que añadía BOM (LL-006).

2) Poner tildes solo en lo que ve el usuario y dejar el resto en ASCII. Descartado: crea dos españoles distintos en el mismo repositorio y nadie sabe cuál toca en cada fichero. La regla tiene que caber en una frase.

3) Reescribir toda la memoria ya escrita para ponerle tildes. Descartado de plano: los ADR, las decisiones y las lecciones son inmutables, y reescribir la historia es justo lo que el proyecto prohíbe. La ortografía no justifica romper la única garantía que sostiene la memoria.
