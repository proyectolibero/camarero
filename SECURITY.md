# Politica de seguridad

## Como reportar una vulnerabilidad

No abras un issue publico para una vulnerabilidad. Escribe un correo al mantenedor con:

- descripcion del problema y su impacto,
- pasos para reproducirlo,
- version o commit afectado,
- cualquier prueba de concepto, si la tienes.

Recibiras acuse de recibo y una valoracion inicial. **No divulgues el problema en publico
hasta que exista un arreglo o hayamos acordado una fecha.** El repositorio es publico: un
detalle concreto en un issue abierto es una via de explotacion.

## Versiones soportadas

El proyecto esta en Fase 0 y no ha publicado ninguna version estable. Solo se da soporte a
la **rama `main`**, que es la unica que se despliega.

## Compromiso de respuesta

El proyecto lo mantiene **una sola persona**. El compromiso es realista, no aspiracional:

| Gravedad | Primer acuse | Objetivo de arreglo |
|----------|--------------|---------------------|
| Critica (RCE, fuga de datos, saltarse el pago o la aprobacion de mesa) | 72 h | 7 dias |
| Alta (escalada de privilegios, RLS saltada) | 7 dias | 30 dias |
| Media / baja | 14 dias | a convenir |

Si el mantenedor no puede atenderlo en plazo, se dira de forma explicita en lugar de dejar
el reporte sin respuesta.

## El repositorio nunca contiene secretos

Este repositorio es **publico** (licencia AGPL). Cero credenciales, tokens, claves o
cadenas de conexion en el codigo o en el historial. Todo secreto vive en variables de
entorno del proveedor (Cloudflare, Supabase) y en `.env` local, que esta en `.gitignore`.

La integracion continua escanea dependencias con `osv-scanner` y falla ante
vulnerabilidades. Si encuentras un secreto commiteado, tratalo como una vulnerabilidad
critica: hay que **rotar la credencial**, no solo borrarla del ultimo commit.
