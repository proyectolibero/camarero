---
id: D-039
type: decision
title: subtotal es la suma de los platos, el descuento se resta, y la propina va sobre lo descontado
status: accepted
date: 2026-09-28
phase: F1
tags:
  - dinero
  - contabilidad
  - producto
related:
  - D-037
  - CONTRACT-dinero
---

## Decision

Definiciones unicas de la cuenta: subtotal es la suma de los platos y sus modificadores, sin descuento. Descuento es la reduccion aplicada, que se resta del subtotal. Lo que paga el cliente es subtotal menos descuento. La propina se calcula sobre el importe ya descontado, nunca sobre el subtotal. El descuento nunca deja el importe por debajo de cero. El total final es el importe descontado mas la propina.

## Justificacion

El usuario ha fijado en lenguaje llano que 'subtotal es lo que suman los platos, luego le restas el descuento y eso es lo que pagas', y que la propina se calcula sobre el precio base ya descontado. Con eso se resuelve una contradiccion real que existia entre D-037 (subtotal = bruto) y CONTRACT-dinero (subtotal = bruto menos descuento), dos documentos aceptados que decian cosas distintas sobre la misma palabra. La definicion elegida coincide con lo que un cliente entiende sin que se lo expliquen, y evita el riesgo de que dos trozos del sistema calculen la misma cuenta de dos formas.

## Alternativas

(A) Dejar las dos definiciones coexistiendo en la memoria: es lo que habia, y es un fallo, porque el dia que alguien programe la caja con una y el ticket con la otra salen dos cifras distintas y acaba en una discusion con un cliente delante. (B) Definir subtotal como bruto menos descuento, como decia CONTRACT-dinero: es defendible contablemente pero menos intuitivo para quien lee la cuenta; el usuario lo descarto expresamente. (C) Calcular la propina sobre el bruto en lugar de sobre el importe ya descontado: le pide al cliente propina sobre dinero que no va a pagar, es injusto y el usuario lo descarto.
