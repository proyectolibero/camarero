---
id: ADR-0028
type: adr
title: El QR de mesa se genera en el servidor como SVG, con una libreria pequeña para la matriz
status: accepted
date: 2026-09-30
tags:
  - panel
  - qr
  - dependencias
  - impresion
  - fase-1
related:
  - ADR-0023
  - CONTRACT-pantallas
  - CONTRACT-modelo-datos
  - TASK-F1-03
  - D-023
---

## Contexto

El dueno necesita imprimir un QR por mesa que lleve al comensal a la direccion de su mesa. El panel se dibuja en el servidor y su CSP prohibe el JavaScript en linea, asi que el QR no puede dibujarlo el navegador. Y un QR impreso no se puede corregir despues: si sale mal, la mesa queda muerta y el fallo aparece delante de un cliente.

## Decision

El QR de mesa se genera en el SERVIDOR como SVG: una libreria pequeña y sin dependencias (candidata `qrcode-generator`, licencia MIT) calcula la matriz de modulos, y el dibujo del SVG es nuestro. El destino del QR sale de una variable de configuracion (el dominio publico), nunca escrito a mano en el codigo.

## Alternativas consideradas

1) Dibujarlo en el navegador con una libreria de JavaScript. Descartado: el panel no tiene JavaScript por CSP (y no queremos meterlo solo para esto), y una hoja que se imprime para pegar en una mesa no debe depender de que un script se ejecute.
2) Implementar el codificador nosotros mismos (codificacion Reed-Solomon y mascaras). Descartado: un QR que parece correcto y no escanea se descubre EN UNA MESA, delante de un cliente. El algoritmo esta definido, pero esta lleno de casos limite, y el riesgo no compensa el ahorro de una dependencia.
3) Generar un PNG. Descartado: un SVG se imprime nitido a cualquier tamano, pesa menos y no necesita un codificador de imagen.
4) Generar el QR en un servicio externo por URL. Descartado de plano: obligaria a mandar a un tercero la direccion de cada mesa y a depender de que ese tercero siga vivo.

## Consecuencias

Se gana: la hoja de QR se genera en el servidor, se imprime nitida y no depende del navegador ni de nadie de fuera; y el alfabeto del codigo (sin 0, O, 1 ni I) hace que se pueda dictar por telefono. Se pierde: se admite una dependencia pequeña de produccion, que hay que justificar (este ADR), vigilar y actualizar. Riesgo que se asume y se mitiga: una libreria que genere un QR incorrecto deja una mesa muerta; por eso la correccion NO se da por supuesta, se comprueba con un vector conocido y con la lectura del propio QR generado.
