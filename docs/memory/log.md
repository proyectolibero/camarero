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

## [2026-09-29] Despliegue en verde y la red de seguridad cazando una vulnerabilidad transitiva de wrangler

Primer despliegue a Cloudflare y primer uso de la red de seguridad en produccion. Al anadir wrangler, arrastro undici 7.29.0, que tiene una vulnerabilidad media (GHSA-3wwx-pv8p-q78v, 5.9, corregida en 7.29.1). El workflow de Seguridad lo detecto solo y puso el push en rojo, aunque CI estaba verde. Se corrigio con un overrides de pnpm que fuerza undici ^7.29.1; el lockfile resolvio 7.29.10. Sin el escaneo, esa dependencia vulnerable habria viajado a produccion sin que nadie la mirara. El coste de haber montado osv-scanner en F0-01 se pago aqui.

**Siguiente paso:** Conectar los dominios personalizados camarero.proyectolibero.org (Pages) y camarero-api.proyectolibero.org (Worker), verificar que responden, y cerrar TASK-F0-03 con la evidencia de las cuatro URLs vivas.

## [2026-09-29] Seguridad reforzada: CodeQL y Scorecard activos, y CodeQL caza una carrera TOCTOU real el primer dia

Se activaron los guardianes gratuitos: CodeQL (analisis estatico con reglas ampliadas), OpenSSF Scorecard, y se confirmo que el escaneo de secretos y el bloqueo de subida (push protection) ya venian activados por defecto en el repositorio publico. Proteccion de rama: sigue exigiendo el check 'Lint, tipos y tests'. DECISION 1: Scorecard dio 5.1/10. Su primer run fallo porque la version fijada v2.4.0 descargaba su imagen de gcr.io, que ahora exige facturacion; subido a v2.4.4 (ghcr.io). DECISION 2: el premio de haber montado esto el primer dia. CodeQL encontro una vulnerabilidad REAL de severidad alta en nuestro codigo: tools/mcp-memory/src/core/store.ts tenia una carrera TOCTOU (CWE-367) entre comprobar el tamano con stat(ruta) y leer con readFile(ruta). Arreglada con leerDocumentoAcotado: abrir una vez y comprobar y leer del MISMO descriptor, de modo que el inodo queda fijado. Verificado: 0 alertas de CodeQL abiertas tras el push, 142 tests en verde. DECISION 3: CodeQL subido de v3 a v4 (v3 se deprecia en diciembre de 2026). Quedan 19 alertas de Scorecard, todas de higiene y proceso, ninguna vulnerabilidad: 13 por fijar acciones por etiqueta en vez de por huella SHA, y una de cada por no tener badge OpenSSF, repositorio de menos de 90 dias, sin revision de cambios, sin fuzzer, y el aviso 'Dangerous-Workflow' que es una falsa alarma razonable (el checkout del workflow_run.head_sha esta protegido por un if que exige push sobre main con CI en verde).

**Siguiente paso:** Opcional: fijar las acciones de CI por huella SHA (13 de las 19 alertas de Scorecard) y anadir el badge OpenSSF. No bloquea. Seguir con F0-04 (acceso del personal) o F0-05 (copias de seguridad) para cerrar la Fase 0.
