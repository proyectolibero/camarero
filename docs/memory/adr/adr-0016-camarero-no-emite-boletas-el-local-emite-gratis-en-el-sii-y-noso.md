---
id: ADR-0016
type: adr
title: "Camarero no emite boletas: el local emite gratis en el SII y nosotros le damos los datos"
status: accepted
date: 2026-09-28
tags:
  - boleta
  - sii
  - legal
  - alcance
  - producto
related:
  - OQ-002
  - RISK-012
  - CONTRACT-dinero
  - D-038
---

## Contexto

Se evaluo que Camarero emitiera la boleta electronica, porque llevamos la cuenta completa de la mesa y el local no siempre tiene TPV moderno. La investigacion del SII lo desmintio: no existe una figura general de 'emision por cuenta de terceros' aplicable a restaurantes (la Res. Ex. 112/2010 es para boletas de espectaculos publicos, con mandatarios, no para bares). El emisor y el responsable fiscal es siempre el RUT del local. Las vias para que un tercero emita exigen ser proveedor autorizado con al menos 10 contribuyentes habilitados y 6 meses de experiencia (Res. 74/2020 letra J), o constituirse en Prestador de Servicios Tributarios Electronicos con 275 UTA de capital propio (Res. 81/2005). Y el sistema gratuito del SII no se integra por API, de modo que tampoco se puede mezclar con una emision paralela. A la vez, el local ya puede emitir gratis en el portal MiPyme o en la app e-Boleta, y desde marzo de 2026 la copia al cliente puede ser virtual (correo, SMS, WhatsApp o QR), lo que permite a un bar sin impresora cumplir legalmente.

## Decision

Camarero no emite boletas electronicas. Camarero lleva la cuenta completa de la mesa y entrega al local los datos de la boleta ya preparados (items, cantidades, precios, neto, IVA separado, total, propina y medio de pago). El local emite en el sistema gratuito del SII, en la web o en la app e-Boleta, y puede autorizar al camarero o al dueno como usuario para que emita en su nombre. Queda como via futura que el local contrate a un proveedor certificado y Camarero se integre a su API, siempre a cuenta y riesgo del local.

## Alternativas consideradas

(A) Que Camarero emita las boletas por el local mediante software propio (LibreDTE u otro): la ley exige que el emisor sea el RUT del local, con su certificado digital y sus folios, y la certificacion se hace por cada local. Nos obligaria a ser proveedor con responsabilidad fiscal, y choca con presupuesto cero y mantenedor unico. Descartada. (B) Que Camarero sea proveedor autorizado ('Sistemas de Emision de Boletas Electronicas' o Prestador de Servicios Tributarios Electronicos): exige al menos 10 contribuyentes y 6 meses de experiencia, y en la via de prestador un capital propio de 275 UTA. Inalcanzable en esta fase. Descartada. (C) Que el local contrate un proveedor (SimpleBoleta ~60.000 al ano, OpenFactura ~360.000 al ano) y Camarero se integre a su API usando la cuenta del local: viable y legal, y no nos hace responsables, pero el local no puede mezclarlo con el sistema gratuito del SII, y hoy ningun local del piloto lo necesita. Queda como via futura, no como plan. (D) Que Camarero emita y el SII no lo sepa: descartado de raiz, es delito tributario y el que participa consciente responde penalmente.

## Consecuencias

Gana: coste cero real para el local y para nosotros; ningun papel fiscal en nuestras manos, con lo que desaparece el riesgo legal y reputacional de un bug que altere un documento tributario; y el local sigue cumpliendo como cumplia. Pierde: no hay integracion automatica, la emision es manual en el portal o la app del SII, y nosotros quedamos como ayuda, no como solucion completa de caja. Ademas, si un local quiere integracion real, tendra que contratar a un proveedor y dejar el sistema gratuito, lo que hoy no le compensa. Se asume a cambio de no cargar con una responsabilidad que no podemos sostener.
