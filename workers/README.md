# workers/

Aqui viviran los Workers de Cloudflare:

- **api/** — borde de la API: web push, cron (keep-alive y backups), rate limit. Tarea:
  Fase 0 (endpoint de salud) y Fase 1 en adelante.
- **backup/** — `pg_dump` cifrado y subida a R2. Tarea: Fase 0.

**No se crea un Worker hasta que tenga contenido real.** Se aplica la misma regla que en
`apps/`: primero el codigo, luego el paquete.
