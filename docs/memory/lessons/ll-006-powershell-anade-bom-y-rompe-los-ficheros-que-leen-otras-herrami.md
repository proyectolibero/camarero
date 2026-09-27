---
id: LL-006
type: lesson
title: PowerShell anade BOM y rompe los ficheros que leen otras herramientas
status: recorded
date: 2026-09-27
tags:
  - powershell
  - bom
  - encoding
  - sql
related: []
---

## Error

Una migracion SQL fallaba con un error de sintaxis en la linea 1 que no correspondia a ningun problema real del SQL. El fichero empezaba por BOM: tres bytes invisibles en el editor que Postgres interpreta como caracteres invalidos.

## Causa raiz

PowerShell, a diferencia de la mayoria de herramientas modernas, antepone BOM al escribir con Set-Content -Encoding UTF8. Se eligio esa via por comodidad al generar varios ficheros SQL desde un script. El BOM es invisible en el editor, asi que nada avisa de que el fichero empieza por tres bytes que no son SQL.

## Prevencion

Nunca usar Set-Content -Encoding UTF8 ni Out-File para ficheros que lea una herramienta externa (SQL, JSON, YAML, configuracion). Usar escritura binaria explicita sin BOM. Y si un fichero falla con un error de sintaxis absurdo en la primera linea, comprobar el BOM antes de buscar el error en el contenido.

## Detalle

Al escribir ficheros SQL con PowerShell, `Set-Content -Encoding UTF8` anade BOM (EF BB BF) al principio. El BOM rompe la aplicacion de la migracion: el primer caracter del fichero deja de ser valido para el parser y Postgres falla con un error de sintaxis confuso en la linea 1. Ocurrio al preparar las migraciones del esquema. Solucion aplicada: escribir con [System.IO.File]::WriteAllText y New-Object System.Text.UTF8Encoding $false, que no emite BOM. Es la misma clase de problema que ya aparecio con los documentos de memoria.
