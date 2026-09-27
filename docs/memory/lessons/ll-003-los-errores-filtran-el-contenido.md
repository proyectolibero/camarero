---
id: LL-003
type: lesson
title: "Los mensajes de error de las librerias filtran el contenido que los provoca"
status: recorded
date: 2026-09-27
tags: [seguridad, privacidad, mcp]
related: []
---

## Error

La invariante declarada era: "ninguna escritura con un secreto pasa el guardian, y el
valor detectado nunca se devuelve". Era falsa, y se demostro asi:

1. Un fichero con el frontmatter roto y un token dentro va a la lista de incidencias de
   carga, no a la del guardian de escritura.
2. El mensaje de incidencia llevaba el mensaje crudo de la libreria YAML, que incluye la
   linea de origen y un puntero. El token salia entero.
3. El informe de `memory_validate` lo devolvia, y de ahi pasaba al contexto de un agente y
   al proveedor del modelo.

Los errores de zod tenian el mismo problema: `Invalid enum value ... received '<token>'`.
Y el mensaje de estado no permitido interpolaba el valor tal cual.

## Causa raiz

Se trato el mensaje de error como texto de diagnostico y no como **salida del servidor**.
Un mensaje de error es una superficie de exfiltracion igual que una respuesta correcta, y
las librerias de terceros no saben que el dato que interpolan puede ser secreto.

## Prevencion

1. **Nunca propagar el mensaje crudo de una libreria.** De `frontmatter.ts` hacia arriba
   los errores se construyen con datos que controlamos: ruta del campo y codigo de error,
   no el valor recibido.
2. **Redaccion en la frontera de salida.** `redactForOutput()` pasa por las mismas reglas
   cualquier texto que vaya a salir, en `fail()` y en las incidencias de carga. Es la red
   bajo el trapecio, no la primera linea.
3. **Escanear tambien lo que no parsea.** Un documento ilegible no se puede validar, pero
   si se puede redactar.
4. **Escanear el frontmatter entero**, no solo el cuerpo: `title` y `owner` tambien los
   escribe una persona.

## Detalle

Regla general: cualquier texto que salga del servidor se considera publico. Si el servidor
habla MCP, ese texto acaba en el prompt de un agente y en un proveedor externo. La
privacidad de un dato no depende de donde se guarda, sino de por donde sale.
