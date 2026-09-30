---
id: ADR-0030
type: adr
title: Las fotos de la carta viven en R2 y las sirve el borde, que solo acepta imagen raster
status: accepted
date: 2026-09-30
tags:
  - carta
  - fotos
  - r2
  - seguridad
  - fase-1
related:
  - ADR-0002
  - ADR-0023
  - CONTRACT-borde
  - CONTRACT-pantallas
  - TASK-F1-05
  - RISK-014
---

## Contexto

El humano ha dicho que las fotos son muy importantes para la carta. El modelo ya reserva el campo de la clave de la foto en R2, y el bucket existe. Pero servir un fichero que sube un usuario desde nuestro propio dominio es uno de los agujeros clasicos: si se acepta cualquier formato, alguien puede subir un documento con codigo dentro y el navegador lo ejecutaria como si fuera nuestro.

## Decision

Las fotos de la carta se suben desde el panel, se validan por CONTENIDO (no por extension), se guardan en R2 con una clave aleatoria y las sirve el BORDE en una ruta propia, con tipo de contenido fijo, nosniff, cache largo y CSP estricta. Solo se acepta imagen raster (JPEG, PNG y WebP): el SVG se rechaza siempre, porque un SVG puede llevar codigo dentro.

## Alternativas consideradas

1) Servir las fotos directamente desde un bucket publico de R2. Descartado: perderiamos el control de las cabeceras (nosniff, CSP, cache) y las direcciones de las fotos quedarian atadas al proveedor; ademas cualquier cosa que se suba se serviria tal cual desde su dominio.
2) Aceptar cualquier formato fiandonos de la extension del fichero. Descartado de plano: la extension la elige quien sube. Un SVG con un script dentro, servido desde nuestro dominio, es una inyeccion de codigo en toda regla. Es el agujero clasico de las subidas de ficheros.
3) Guardar las fotos en la base de datos (como binario o en base64). Descartado: infla la base, la mete dentro de las copias de seguridad y rompe la regla de que aqui vive el desarrollo y alli los datos de producto. R2 da 10 GB gratis.
4) Redimensionar y optimizar en el borde desde el principio. Descartado POR AHORA: redimensionar en un Worker exige herramientas que no trae de serie y el servicio de imagenes de Cloudflare no entra en el plan gratuito. Se decide cuando haya trafico real que lo justifique, y entonces con numeros delante.

## Consecuencias

Se gana: las fotos salen por nuestro dominio, con nuestras cabeceras y nuestro cache, y el dia que cambiemos de almacen las direcciones no cambian; y una subida maliciosa no puede convertirse en codigo en el navegador de nadie. Se pierde: hay que mantener una ruta de servicio y su validacion, y las fotos se guardan tal como se suben, asi que un dueno puede subir una foto de varios megas y hacer lenta la carta del comensal. Mitigacion: limite de tamano explicito y un aviso claro en la pantalla; la optimizacion real queda como decision posterior con motivo, no por si acaso.
