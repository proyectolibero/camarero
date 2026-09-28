---
id: log
type: log
title: Bitacora del proyecto
status: append-only
date: 2026-09-27
tags: []
related: []
---

# Bitacora

Registro cronologico de lo que ocurre en el proyecto.

## [2026-09-27] Bloqueo en F0-02: hace falta decidir el diseno del aislamiento antes de seguir

Preguntas al humano, en orden de dependencia:

1. ¿Por que camino vamos? (A) Desnormalizar org_id y location_id en todas las tablas que hoy los alcanzan por join, de modo que ninguna politica necesite una subconsulta. Es mas columnas y mas trabajo en las migraciones, pero el aislamiento deja de depender de funciones que leen tablas y el problema desaparece de raiz. (B) Resolver el contexto completo del actor (organizacion, local, sesion y rol) al abrir la sesion de base de datos, de modo que las politicas solo comparen con valores ya presentes en el ajuste. Es menos cambio de esquema pero deja la correccion del aislamiento en manos del borde: si el borde fija mal el contexto, el aislamiento se cae.

2. La suite tiene que volver a 123 tests en verde, y hoy esta en 99 con 24 omitidos. ¿Se acepta como objetivo intermedio el rojo actual mientras se rediseña, o se prefiere revertir 0011 y 0012 y volver al ultimo estado verde (aislamiento entre organizaciones funcionando, sin proteccion de importes) antes de seguir?

3. El calculo de totales y descuentos de la comanda no tiene hoy ninguna proteccion en la base de datos y es un agujero de dinero. ¿Donde debe vivir: disparador BEFORE en orders como fija ADR-0008, o funcion que el borde esta obligado a llamar, con un test que compruebe que sin llamarla la comanda no puede cerrarse?

4. Las migraciones descartadas estan en packages/db/migrations/descartadas/ con extension .descartada. ¿Se borran cuando el diseno nuevo este verificado, o se conservan como registro de lo que se intento?

**Siguiente paso:** Esperar la decision del humano sobre el camino A o B antes de escribir mas SQL. La tarea TASK-F0-02 queda abierta y bloqueada, no cerrada.

## [2026-09-27] Hecho verificado: los ciclos de politicas RLS se detectan automaticamente con una consulta SQL

Se necesitaba saber si la regla de ADR-0010 (la politica de una tabla no puede leer esa misma tabla, ni directa ni transitivamente) era comprobable de forma automatica, porque sin esa comprobacion la regla es una convencion que se rompe sin que nadie se entere, que es exactamente lo que ocurrio tres veces. Resultado: SI se puede, con SQL puro y sin dependencias nuevas, y el metodo ha superado los dos controles. Control positivo: aplicado a las migraciones descartadas detecta los tres ciclos conocidos (locations -> locations; y locations -> table_sessions -> locations en el intento 3). Control negativo: aplicado a las 96 politicas de 0010 devuelve cero filas, sin falsos positivos. Limitaciones: no detecta SQL dinamico (EXECUTE), ni cuerpos plpgsql con EXECUTE, ni el paso por vistas; y depende de que las referencias esten cualificadas con public.

**Siguiente paso:** Convertir el detector en un test permanente junto a rls.test.ts, de modo que el ciclo se detecte en el pipeline y no en produccion.

## [2026-09-28] Cierre de OQ-002: TPV de barrio sin API, tablets utiles desde 90.000 CLP, la integracion con POS instalado queda descartada

Los TPV instalados en local (Chief Chef, Resto, SDYDPunto, Checkout POS, Kildar, NexoGourmet) NO tienen API publica. Lo que ofrecen es exportacion a fichero (CSV, DBF, Excel) que se lee a posteriori, bases de datos propias fragiles (SQL Server en Kildar) que se rompen con cada actualizacion, y soporte ESC/POS para impresoras termicas. Se puede imprimir un ticket desde una tablet (Bluetooth con plugin HTTP->ESC/POS, o TCP al 9100), pero un ticket NO es una boleta electronica: solo vale para la comanda y la cuenta interna. Conclusion: integrarse con el TPV de barrio es un proyecto por cliente, no una capacidad de producto, y la ilusion de 'leer de cualquier TPV' queda descartada con motivo. Sobre las tablets: hay opciones utiles por 90.000-170.000 CLP verificadas en tiendas chilenas (Lenovo Tab K10, Crusect, Kodak K10, TCL Tab 10L, Acer Iconia A11, MLAB Studio Prime, Xiaomi Redmi Pad 2, Honor Pad X7). Un movil Android viejo del local sirve y cuesta cero; un movil nuevo barato ronda los 108.000. Los enemigos reales no son las caidas sino el sol (las baratas son de ~400 nits y en terraza a pleno sol se leen mal), la grasa y la bateria (aguanta un turno justo, mejor un cargador en barra). Existen tablets industriales resistentes (Unitech TB85 Plus, Getac, Ruggtek) pero cuestan cientos de miles: fuera de presupuesto. Decision tomada: D-040.

**Siguiente paso:** OQ-002 resuelta. Decisiones asociadas: ADR-0016 (la boleta la emite el local), D-040 (movil viejo primero, tablet como premio). No hace falta mas investigacion de mercado en esta fase: el producto se basta solo sin integrarse con TPV de barrio.
