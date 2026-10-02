/**
 * La piel que se sirve: tokens del modelo por defecto, las pantallas propias de este
 * producto (mapa, sala, cocina, carta, comensal, impresion) y los componentes basicos.
 *
 * Los colores NO viven aqui: vienen de `temaCss` (paquete @camarero/ui). Esta hoja solo usa
 * alias. La hoja de un local concreto la genera el borde con `temaCss(modelo, acento)`.
 */
import { COMPONENTES_CSS } from "./componentes.ts"
import { MODELO_POR_DEFECTO, temaCss } from "./temas.ts"

const PANTALLAS = `


.pantallas {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  overflow: hidden;
}

.pantallas li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 0.9rem;
  border-top: 1px solid var(--borde);
  color: var(--tinta-suave);
}

.pantallas li:first-child {
  border-top: 0;
}

.pantallas .pronto {
  flex: 0 0 auto;
  font-size: 0.8rem;
  color: var(--tinta-suave);
}

.pantallas a {
  color: var(--acento);
  font-weight: 600;
}

.plano {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  overflow: hidden;
}

.plano li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.65rem 0.9rem;
  border-top: 1px solid var(--borde);
}

.plano li:first-child {
  border-top: 0;
}

.plano .etiqueta,
.plano .cuenta {
  color: var(--tinta-suave);
  font-size: 0.85rem;
}

.plano .cuenta {
  margin-left: auto;
}

.plano-grupo {
  margin-bottom: 1rem;
}

.plano-grupo h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}

.mesa-etiqueta {
  font-weight: 600;
}

.mesa-codigo {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.08em;
  background: var(--fondo);
  border: 1px solid var(--borde);
  border-radius: 0.35rem;
  padding: 0.1rem 0.4rem;
}

.mesa-datos {
  color: var(--tinta-suave);
  font-size: 0.8rem;
}

.mesa-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  width: 100%;
}

.mesa-cabecera form {
  margin-left: auto;
}

/* El boton de activar/desactivar se aprieta para que la fila quepa de una linea en el movil. */
.mesa-cabecera form .boton {
  padding: 0.45rem 0.7rem;
  font-size: 0.85rem;
}

/* El mapa no tiene JavaScript: se dibuja en el servidor y se adapta al ancho del movil. */
.mapa-svg {
  display: block;
  width: 100%;
  height: auto;
  max-width: 40rem;
  margin: 0 0 0.75rem;
}

/* Elegir mesa es un enlace: se toca la ficha en el mapa, no se arrastra nada. */
.mapa-enlace {
  cursor: pointer;
}

.mapa-enlace:hover .mapa-mesa,
.mapa-enlace:focus-visible .mapa-mesa {
  stroke: var(--acento);
  stroke-width: 3;
}

/* La elegida se marca sola: el mapa dice cual se va a mover, sin coordenadas en jerga. */
.mapa-ficha-elegida .mapa-mesa {
  stroke: var(--tinta);
  stroke-width: 4;
  stroke-dasharray: none;
}

.mapa-celda {
  fill: var(--mapa-celda-fondo);
  stroke: var(--mapa-celda-borde);
  stroke-width: 1;
}

.mapa-mesa {
  stroke: var(--mapa-mesa-borde);
  stroke-width: 2;
}

.mapa-mesa-activa {
  fill: var(--mapa-mesa-fondo);
}

/* Sin fill en la hoja: manda el atributo con el patron de rayas. */
.mapa-mesa-inactiva {
  stroke: var(--mapa-inactiva-borde);
  stroke-dasharray: 4 3;
}

.mapa-inactiva-fondo {
  fill: var(--mapa-inactiva-fondo);
}

.mapa-raya {
  stroke: var(--mapa-inactiva-raya);
  stroke-width: 2;
}

.mapa-etiqueta {
  fill: var(--mapa-mesa-tinta);
  font-size: 13px;
  font-weight: 600;
}

.mapa-etiqueta-inactiva {
  fill: var(--mapa-inactiva-tinta);
}

/* Un solo juego de flechas, grande, pegado al mapa de la mesa elegida. */
.mover-caja {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin: 0 0 0.75rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: var(--fondo);
}

.mover-titulo {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  color: var(--tinta-suave);
}

.mover-titulo strong {
  color: var(--tinta);
}

.mover-quitar {
  font-size: 0.85rem;
  color: var(--acento);
}

.mover-ayuda {
  color: var(--tinta-suave);
  margin: 0 0 0.75rem;
}

.mover {
  display: grid;
  grid-template-columns: repeat(3, minmax(2.75rem, 3rem));
  grid-template-rows: repeat(3, auto);
  gap: 0.35rem;
  justify-content: center;
  width: 100%;
}

.mover-boton {
  min-width: 2.75rem;
  min-height: 2.75rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: var(--papel);
  color: var(--tinta);
  font: inherit;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}

.mover-boton:hover {
  border-color: var(--acento);
}

.mover-arriba {
  grid-area: 1 / 2 / 2 / 3;
}

.mover-izquierda {
  grid-area: 2 / 1 / 3 / 2;
}

/* Hueco central del mando: el centro queda libre, sin la posicion en jerga. */
.mover-hueco {
  grid-area: 2 / 2 / 3 / 3;
}

.mover-derecha {
  grid-area: 2 / 3 / 3 / 4;
}

.mover-abajo {
  grid-area: 3 / 2 / 4 / 3;
}

/* Una linea por mesa: etiqueta, codigo, capacidad, estado, QR y activar/desactivar. Sin flechas. */
.plano li.mesa {
  display: block;
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
}

/*
 * La mesa desactivada tiene que NOTARSE y LEERSE. Antes se apagaba con opacity: 0.6, que
 * rebajaba el texto a 2,8:1 y dejaba justo la fila que el dueno busca casi invisible. Ahora
 * se distingue por el color (fondo apagado y tinta suave) y por el borde discontinuo, sin
 * tocar la opacidad del texto. Contraste medido en tests/contraste-mapa.test.ts.
 */
.mesa-inactiva {
  background: var(--mapa-inactiva-fondo);
}

.mesa-inactiva .mesa-codigo {
  background: transparent;
  border-color: var(--mapa-inactiva-borde);
  color: var(--mapa-inactiva-tinta);
}

.mesa-inactiva .mesa-datos {
  color: var(--tinta-suave);
}

.mesa-inactiva .mesa-etiqueta {
  color: var(--mapa-inactiva-tinta);
}

.mesa-qr {
  color: var(--acento);
  font-weight: 600;
}

.qr {
  background: var(--qr-fondo);
  padding: 0.5rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
}

.qr svg {
  display: block;
  width: 100%;
  height: auto;
}

.qr-ficha {
  max-width: 18rem;
  margin: 0 auto;
  text-align: center;
}

.qr-etiqueta {
  font-weight: 600;
  margin: 0 0 0.4rem;
}

.qr-codigo {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  margin: 0.4rem 0 0;
}

.qr-url {
  color: var(--tinta-suave);
  font-size: 0.8rem;
  word-break: break-all;
}

.hoja-mesas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1.25rem;
}

@media (max-width: 30rem) {
  .tarjeta {
    padding: 1.1rem;
  }

  .datos {
    grid-template-columns: 1fr;
    gap: 0.1rem 0;
  }

  .datos dt {
    margin-top: 0.5rem;
  }
}

/*
 * Impresion de las hojas de QR. Una hoja que imprime mal es una mesa muerta: fuera cabecera,
 * botones y fondos; el QR grande y en negro puro sobre blanco.
 */
@media print {
  :root {
    color-scheme: light;
  }

  body {
    background: #ffffff;
    color: #000000;
  }

  .cabecera,
  .no-imprimir,
  .boton,
  .boton-salir {
    display: none !important;
  }

  .contenedor {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .tarjeta {
    background: #ffffff;
    border: 0;
    border-radius: 0;
    padding: 0;
  }

  .qr {
    background: #ffffff;
    border: 0;
    padding: 0;
  }

  .qr svg {
    width: 70mm;
    height: auto;
  }

  .qr-codigo,
  .qr-etiqueta,
  .qr-url {
    color: #000000;
  }

  .qr-codigo {
    font-size: 3rem;
  }

  .hoja-mesas {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .qr-ficha {
    break-inside: avoid;
    page-break-inside: avoid;
    max-width: none;
  }
}

/* ---------------------------------------------------------------------------
   La carta. Las filas se leen de un vistazo: nombre, precio, estación e insignias.
   Lo agotado y lo retirado se distinguen por color y por texto, NO por opacidad
   (LL-020: apagar el texto deja invisible justo la fila que se busca).
   --------------------------------------------------------------------------- */

.carta-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  overflow: hidden;
}

.carta-lista li {
  border-top: 1px solid var(--borde);
}

.carta-lista li:first-child {
  border-top: 0;
}

.carta-categoria .carta-linea {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
  padding: 0.65rem 0.9rem;
}

.carta-categoria.carta-oculta {
  background: var(--mapa-inactiva-fondo);
}

.carta-categoria.carta-oculta .carta-nombre {
  color: var(--mapa-inactiva-tinta);
}

.carta-nombre {
  font-weight: 600;
  color: var(--acento);
}

.carta-estado {
  font-size: 0.8rem;
  color: var(--tinta-suave);
}

.renombrar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.renombrar input {
  min-width: 8rem;
  flex: 1 1 8rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--borde);
  border-radius: 0.4rem;
  background: var(--fondo);
  color: var(--tinta);
  font: inherit;
}


.mover-orden {
  display: inline-flex;
  gap: 0.25rem;
}

.carta-plato {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  padding: 0.65rem 0.9rem;
}

.carta-plato-retirado {
  background: var(--mapa-inactiva-fondo);
}

.carta-plato-agotado {
  background: var(--error-fondo);
}

.plato-foto {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: cover;
  border-radius: 0.4rem;
  border: 1px solid var(--borde);
  background: var(--fondo);
}

.plato-sinfoto {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border: 1px dashed var(--borde);
  border-radius: 0.4rem;
  color: var(--tinta-suave);
  font-size: 0.7rem;
  text-align: center;
}

.plato-texto {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 8rem;
  flex: 1 1 8rem;
}

.plato-nombre {
  font-weight: 600;
}

.plato-datos {
  color: var(--tinta-suave);
  font-size: 0.9rem;
}

.plato-gestion,
.plato-acciones {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}





.foto-actual {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.foto-actual .plato-foto {
  width: 6rem;
  height: 6rem;
}

/* ---------------------------------------------------------------------------
   La pantalla del comensal. Se lee en un movil bajo la mesa: foto, nombre y precio
   grande, y un boton claro para pedir el emparejamiento.
   --------------------------------------------------------------------------- */

/*
 * La cabecera del comensal se queda pegada arriba (D-056): el gasto y el camino a su desglose
 * siguen a la vista aunque se baje por la carta, que es donde mas tiempo pasa y donde decide
 * si pide mas. Es sticky y no fija con posicionamiento: ocupa su franja en el flujo y empuja
 * el contenido, no lo tapa. La franja va en su propia linea, debajo de la marca y el local.
 */
.comensal-cabecera {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  padding: 0.6rem 1.25rem 0.5rem;
  background: var(--papel);
  border-bottom: 1px solid var(--borde);
}

.comensal-cabecera .marca {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.comensal-local {
  color: var(--tinta-suave);
}

/* La franja del gasto: gasto, enlace al desglose (o de vuelta) y nada mas, para leerse de un
   vistazo con el movil en la mano. Ocupa toda la linea dentro de la cabecera. */
.comensal-gasto {
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.6rem;
  margin: 0;
  padding-top: 0.4rem;
  border-top: 1px solid var(--borde);
}

.comensal-gasto-etiqueta {
  color: var(--tinta-suave);
  font-size: 0.9rem;
}

.comensal-gasto strong {
  font-size: 1.15rem;
  color: var(--acento);
}

/* Sin nada pedido no hay importe que enseñar: se dice, no se pinta un cero sin explicacion. */
.comensal-gasto-vacio {
  color: var(--tinta-suave);
  font-size: 0.9rem;
}

/* Es el camino que mas se toca con el movil en la mano: un objetivo mas comodo que el mini. */
.comensal-gasto .boton-mini {
  padding: 0.5rem 0.85rem;
  font-size: 0.9rem;
}

.comensal-mesa {
  font-size: 1.7rem;
  margin-bottom: 0.75rem;
}

.comensal-carta-titulo {
  margin-top: 2rem;
}

.emparejamiento {
  border: 1px solid var(--borde);
  border-radius: 0.75rem;
  padding: 1rem 1.1rem;
  margin: 0 0 1.25rem;
  background: var(--papel);
}

.emparejamiento p:last-child {
  margin-bottom: 0;
}

.emparejamiento-espera {
  background: var(--aviso-fondo);
  border-color: var(--aviso-borde);
}

.emparejamiento-ok {
  background: var(--exito-fondo);
  border-color: currentColor;
  color: var(--exito);
}

.emparejamiento-error {
  background: var(--error-fondo);
  border-color: currentColor;
  color: var(--error);
}

.cuenta-pedir,
.cuenta-pedida {
  border: 1px solid var(--borde);
  border-radius: 0.75rem;
  padding: 1rem 1.1rem;
  margin: 0 0 1.25rem;
  background: var(--papel);
}

.cuenta-pedida {
  background: var(--exito-fondo);
  border-color: currentColor;
  color: var(--exito);
}

.cuenta-pedida p:last-child {
  margin-bottom: 0;
}


.comensal-categoria {
  margin-bottom: 1.5rem;
}

.comensal-platos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.comensal-plato {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: var(--papel);
  border: 1px solid var(--borde);
  border-radius: 0.75rem;
  padding: 0.75rem;
}

.comensal-foto {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 1px solid var(--borde);
  flex: 0 0 auto;
}

.comensal-plato-texto {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.comensal-plato-nombre {
  font-weight: 600;
}

.comensal-plato-desc {
  color: var(--tinta-suave);
  font-size: 0.9rem;
}

.comensal-plato-precio {
  font-weight: 600;
  color: var(--acento);
}

/* ---------------------------------------------------------------------------
   Solicitudes de emparejamiento pendientes en el panel.
   --------------------------------------------------------------------------- */

.parejas {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  overflow: hidden;
}

.pareja {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.7rem 0.9rem;
  border-top: 1px solid var(--borde);
}

.pareja:first-child {
  border-top: 0;
}

.pareja-mesa {
  font-weight: 600;
}

.pareja-tiempo {
  color: var(--tinta-suave);
  font-size: 0.85rem;
}

.pareja-rechazo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.pareja-rechazo input {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--borde);
  border-radius: 0.4rem;
  background: var(--fondo);
  color: var(--tinta);
  font: inherit;
}

/* ---------------------------------------------------------------------------
   Los avisos del comensal en el panel del personal (TASK-F1-13).
   --------------------------------------------------------------------------- */

.avisos-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  overflow: hidden;
}

.aviso-fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  padding: 0.7rem 0.9rem;
  border-top: 1px solid var(--borde);
}

.aviso-fila:first-child {
  border-top: 0;
}

.aviso-tipo {
  font-weight: 700;
}

.aviso-mesa {
  font-weight: 600;
}

.aviso-tiempo {
  color: var(--tinta-suave);
  font-size: 0.85rem;
}

/* ---------------------------------------------------------------------------
   La cesta del comensal y el estado de sus pedidos.
   --------------------------------------------------------------------------- */

.comensal-agregar {
  margin-left: auto;
  flex: 0 0 auto;
}

.comensal-cesta-aviso {
  margin: 0 0 1rem;
}

.cesta-lista {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  border: 1px solid var(--borde);
  border-radius: 0.75rem;
  overflow: hidden;
}

.cesta-linea {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.9rem;
  padding: 0.75rem 0.9rem;
  background: var(--papel);
  border-top: 1px solid var(--borde);
}

.cesta-linea:first-child {
  border-top: 0;
}

.cesta-nombre {
  display: flex;
  flex-direction: column;
  flex: 1 1 9rem;
  min-width: 0;
  font-weight: 600;
}

.cesta-unitario {
  color: var(--tinta-suave);
  font-size: 0.8rem;
  font-weight: 400;
}

.cesta-cantidad {
  font-weight: 600;
  color: var(--tinta-suave);
}

.cesta-subtotal {
  min-width: 4.5rem;
  text-align: right;
  font-weight: 600;
}

.cesta-controles {
  display: inline-flex;
  gap: 0.3rem;
}

.cesta-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 1.2rem;
  padding: 0.5rem 0.2rem 0;
  margin: 0 0 1rem;
  border-top: 2px solid var(--borde);
}

.cesta-aviso {
  margin-bottom: 1.25rem;
}

.cesta-bloqueo {
  margin-top: 0.5rem;
}

.pedido-estado {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 0.8rem;
  font-weight: 600;
}

.pedido-estado-pendiente {
  color: var(--acento);
}

.pedido-estado-preparando {
  color: var(--tinta-suave);
}

.pedido-estado-lista {
  color: var(--exito);
}

.pedido-estado-anulada {
  color: var(--error);
}

.pedido-lineas {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}

.pedido-lineas li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.2rem 0;
  border-top: 1px solid var(--borde);
}

.pedido-lineas li:first-child {
  border-top: 0;
}

.pedido-comensal {
  margin-bottom: 1rem;
}

.pedido-total {
  display: flex;
  justify-content: space-between;
  margin: 0.6rem 0 0;
  padding-top: 0.5rem;
  border-top: 1px solid var(--borde);
}

/* ---------------------------------------------------------------------------
   La cocina: la comanda nueva tiene que saltar a la vista (LL-020: se mira).
   --------------------------------------------------------------------------- */

.pedidos-cocina {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.pedido-cocina {
  border: 1px solid var(--borde);
  border-left: 0.4rem solid var(--borde);
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--papel);
}

/* La nueva se marca con acento a la izquierda, fondo propio y una etiqueta de texto: no
   solo por color, para que se distinga sin depender de la vista. */
.pedido-cocina-pendiente {
  border-color: var(--acento);
  border-left-color: var(--acento);
  background: var(--exito-fondo);
}

/* Una comanda recien enviada por un puesto automatico tambien tiene que saltar a la vista,
   aunque su estado ya sea aceptada (la bebida nace aceptada, ADR-0033). */
.pedido-cocina-nueva {
  border-color: var(--acento);
  border-left-color: var(--acento);
  background: var(--exito-fondo);
}

/* Navegacion entre las pantallas de puesto: la tablet se queda fijada en una. */
.puestos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.5rem 0 0.75rem;
}

.puesto-enlace,
.puesto-actual {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--borde);
  text-decoration: none;
}

.puesto-actual {
  border-color: var(--acento);
  font-weight: 700;
}

.pedido-cocina-anulada {
  opacity: 0.75;
  border-left-color: var(--error);
}

.pedido-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.75rem;
}

.pedido-mesa {
  font-weight: 700;
  font-size: 1.1rem;
}

.pedido-tiempo {
  color: var(--tinta-suave);
  font-size: 0.85rem;
}

/* El destino de la comanda en la cabecera del puesto. NO se ensena ningun importe aqui:
   quien prepara no cobra (ADR-0033). Distinto nombre que el total del pedido del comensal,
   que lleva borde superior, para no pisarse (visto al mirar la previsualizacion, LL-020). */
.pedido-destino {
  font-weight: 600;
  color: var(--tinta-suave);
}

.pedido-nueva {
  margin: 0.5rem 0 0;
  color: var(--exito);
  font-weight: 600;
}

.pedido-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.boton-anular {
  color: var(--error);
  border-color: currentColor;
}

/* ---------------------------------------------------------------------------
   La sala (D-053). Cada mesa lleva su estado por relleno, borde y un glifo de forma:
   se distingue aunque no se distinga el color. El contraste del texto lo mide el test.
   --------------------------------------------------------------------------- */

.mapa-mesa-sala {
  stroke-width: 2;
}

.mapa-mesa-estado-libre {
  fill: var(--sala-libre-fondo);
  stroke: var(--sala-libre-tinta);
}

/* El borde discontinuo dice "aqui falta una decision" sin depender del color. */
.mapa-mesa-estado-esperando_aprobacion {
  fill: var(--sala-espera-fondo);
  stroke: var(--sala-espera-tinta);
  stroke-dasharray: 5 3;
}

.mapa-mesa-estado-comandas_pendientes {
  fill: var(--sala-pendiente-fondo);
  stroke: var(--sala-pendiente-tinta);
}

.mapa-mesa-estado-todo_servido {
  fill: var(--sala-servido-fondo);
  stroke: var(--sala-servido-tinta);
}

.mapa-etiqueta-estado-libre {
  fill: var(--sala-libre-tinta);
}

.mapa-etiqueta-estado-esperando_aprobacion {
  fill: var(--sala-espera-tinta);
}

.mapa-etiqueta-estado-comandas_pendientes {
  fill: var(--sala-pendiente-tinta);
}

.mapa-etiqueta-estado-todo_servido {
  fill: var(--sala-servido-tinta);
}

/* Glifos de forma: ?, ! y marca. La mesa libre no lleva glifo. */
.mapa-glifo {
  font-size: 15px;
  font-weight: 700;
}

.mapa-glifo-esperando_aprobacion {
  fill: var(--sala-espera-tinta);
}

.mapa-glifo-comandas_pendientes {
  fill: var(--sala-pendiente-tinta);
}

.mapa-glifo-todo_servido {
  fill: var(--sala-servido-tinta);
}

.sala-leyenda {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.sala-leyenda li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.sala-muestra {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  flex: 0 0 auto;
  border-radius: 0.35rem;
  border: 2px solid;
  font-weight: 700;
}

.sala-muestra-libre {
  background: var(--sala-libre-fondo);
  border-color: var(--sala-libre-tinta);
  color: var(--sala-libre-tinta);
}

.sala-muestra-esperando_aprobacion {
  background: var(--sala-espera-fondo);
  border-color: var(--sala-espera-tinta);
  color: var(--sala-espera-tinta);
  border-style: dashed;
}

.sala-muestra-comandas_pendientes {
  background: var(--sala-pendiente-fondo);
  border-color: var(--sala-pendiente-tinta);
  color: var(--sala-pendiente-tinta);
}

.sala-muestra-todo_servido {
  background: var(--sala-servido-fondo);
  border-color: var(--sala-servido-tinta);
  color: var(--sala-servido-tinta);
}

.sala-leyenda-texto {
  color: var(--tinta);
  font-size: 0.9rem;
}

.sala-estado {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 0.8rem;
  font-weight: 600;
}

.sala-estado-libre {
  background: var(--sala-libre-fondo);
  color: var(--sala-libre-tinta);
}

.sala-estado-esperando_aprobacion {
  background: var(--sala-espera-fondo);
  color: var(--sala-espera-tinta);
  border-style: dashed;
}

.sala-estado-comandas_pendientes {
  background: var(--sala-pendiente-fondo);
  color: var(--sala-pendiente-tinta);
}

.sala-estado-todo_servido {
  background: var(--sala-servido-fondo);
  color: var(--sala-servido-tinta);
}

/* La mesa fuera de servicio reutiliza el gris rayado del mapa: no es un estado de sala. */
.sala-estado-desactivada {
  background: var(--mapa-inactiva-fondo);
  color: var(--mapa-inactiva-tinta);
}

.sala-glifo {
  font-weight: 700;
}

.mesa-enlace {
  color: var(--acento);
  font-weight: 600;
  text-decoration: none;
}

.mesa-enlace:hover {
  text-decoration: underline;
}

/* ---------------------------------------------------------------------------
   La identidad del local en la carta (TASK-F4-01): logo, portada, pildoras de
   categoria, boton de pulgar y avisos. Todo con tokens: ningun color a mano.
   --------------------------------------------------------------------------- */

/* El logo se pinta a la altura del texto de la marca: pequeno y en linea. */
.comensal-logo {
  height: 1.6rem;
  width: auto;
  max-width: 6rem;
  object-fit: contain;
  border-radius: 0.3rem;
  vertical-align: middle;
}

/* La portada abre la carta: ancha, con esquinas y sin deformar la imagen. */
.comensal-portada {
  display: block;
  width: 100%;
  max-height: 12rem;
  object-fit: cover;
  border-radius: 0.75rem;
  margin: 0 0 0.9rem;
}

.comensal-principal {
  padding-top: 1rem;
}

/* Las categorias como pildoras para saltar: se desplazan en horizontal si no caben. */
.comensal-pildoras {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.2rem 0 0.75rem;
  margin: 0 0 0.5rem;
  scroll-snap-type: x proximity;
}

.comensal-pildora {
  flex: 0 0 auto;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--borde);
  border-radius: 999px;
  background: var(--papel);
  color: var(--texto);
  font-weight: 600;
  text-decoration: none;
  scroll-snap-align: start;
}

.comensal-pildora:hover,
.comensal-pildora:focus-visible {
  border-color: var(--acento);
  color: var(--acento);
}

.comensal-categoria-titulo {
  scroll-margin-top: 5rem;
}

/* El boton de anadir es GRANDE y de PULGAR (D-057): no un enlace pequeño. */
.comensal-agregar-boton {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 3rem;
  padding: 0.7rem 1.1rem;
  font-size: 1rem;
  white-space: nowrap;
}

.comensal-agregar-signo {
  font-size: 1.4rem;
  line-height: 1;
  font-weight: 700;
}

/* Sin foto, una silueta discreta en vez de un hueco roto. */
.comensal-foto-vacia {
  background: var(--superficie-tenue);
  border-style: dashed;
}

/* Los dos avisos al personal: botones claros y, si ya esta pedido, la confirmacion. */
.comensal-avisos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 1.25rem;
}

.comensal-avisos-titulo {
  flex: 1 1 100%;
  margin: 0;
  font-weight: 600;
}

.comensal-aviso-boton {
  min-height: 2.75rem;
}

.comensal-aviso-hecho {
  margin: 0;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--exito);
  border-radius: 0.5rem;
  background: var(--exito-fondo);
  color: var(--exito);
  font-weight: 600;
}

`

/** Hoja completa para un modelo (y, si se pasa, un acento propio del local). */
export function estilosDe(nombre: string, acento?: string): string {
  return `${temaCss(nombre, acento)}\n${PANTALLAS}\n${COMPONENTES_CSS}`
}

export const ESTILOS = estilosDe(MODELO_POR_DEFECTO)
