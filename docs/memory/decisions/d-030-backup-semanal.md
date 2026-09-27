---
id: D-030
type: decision
title: "Backup semanal propio con cifrado y subida a R2"
status: accepted
date: 2026-09-27
tags: [operacion, infraestructura]
related: []
---

## Decision

Se realiza un backup semanal completo con `pg_dump`, cifrado y subido a Cloudflare R2, con
retención de 4 copias semanales y 1 mensual durante 6 meses, junto a un keep-alive diario.

## Justificacion

Supabase Free no incluye backups automáticos y pausa el proyecto tras 7 días de
inactividad. Un backup nunca probado no es un backup, así que se exige un ensayo real de
restauración antes de los pilotos.

## Alternativas

- **Confiar en los backups de Supabase:** descartado porque el plan Free no los incluye.
- **Supabase Pro:** descartado hasta tener ingresos; es el primer gasto aprobado con la
  primera cuota.
- **Backup solo local:** descartado por fragilidad y por no cubrir desastres del proveedor.
