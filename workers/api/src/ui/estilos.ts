/**
 * La piel compartida del panel.
 *
 * Es una constante de texto, no un fichero estatico, para que viaje con el Worker y no haga
 * falta empaquetar nada. Se sirve como hoja de estilos aparte (`GET /panel/estilos.css`)
 * porque el CSP no permite estilos en linea: ni `unsafe-inline` ni `style=` en el HTML.
 */

export const ESTILOS = `:root {
  color-scheme: light dark;
  --tinta: #1b1b1f;
  --tinta-suave: #55555e;
  --fondo: #f6f6f4;
  --papel: #ffffff;
  --borde: #d9d9d1;
  --acento: #1f6b4a;
  --acento-tinta: #ffffff;
  --error: #8f1d1d;
  --error-fondo: #fbecec;
  --exito: #14532d;
  --exito-fondo: #e8f5ec;

  /* Paleta propia del mapa (LL-020): la ficha de la mesa tiene que distinguirse de un vistazo
     de la celda, que solo es una referencia. La etiqueta supera 4,5:1 sobre su relleno en los
     dos temas; el valor se comprueba en tests/contraste-mapa.test.ts, no a ojo. */
  --mapa-celda-fondo: #eef0ee;
  --mapa-celda-borde: #d9d9d1;
  --mapa-mesa-fondo: #1f6b4a;
  --mapa-mesa-borde: #ffffff;
  --mapa-mesa-tinta: #ffffff;
  --mapa-inactiva-fondo: #e7e9eb;
  --mapa-inactiva-raya: #9aa0a6;
  --mapa-inactiva-borde: #6b7076;
  --mapa-inactiva-tinta: #1b1b1f;
}

@media (prefers-color-scheme: dark) {
  :root {
    --tinta: #ececf1;
    --tinta-suave: #a8a8b3;
    --fondo: #16161a;
    --papel: #1e1e24;
    --borde: #33333c;
    --acento: #4fae7e;
    --acento-tinta: #0f1b14;
    --error: #ffb4b4;
    --error-fondo: #3a1e1e;
    --exito: #b6e6c6;
    --exito-fondo: #17301f;

    --mapa-celda-fondo: #24242b;
    --mapa-celda-borde: #33333c;
    --mapa-mesa-fondo: #4fae7e;
    --mapa-mesa-borde: #1e1e24;
    --mapa-mesa-tinta: #0f1b14;
    --mapa-inactiva-fondo: #2a2a31;
    --mapa-inactiva-raya: #5a5a63;
    --mapa-inactiva-borde: #8a8a93;
    --mapa-inactiva-tinta: #ececf1;
  }
}

* {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--fondo);
  color: var(--tinta);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 0.85rem 1.25rem;
  background: var(--papel);
  border-bottom: 1px solid var(--borde);
}

.cabecera .marca {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.cabecera .quien {
  color: var(--tinta-suave);
}

.cabecera .quien strong {
  color: var(--tinta);
}

.cabecera .crece {
  flex: 1 1 auto;
}

.contenedor {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}

.tarjeta {
  background: var(--papel);
  border: 1px solid var(--borde);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

h1 {
  font-size: 1.5rem;
  margin: 0 0 1rem;
}

h2 {
  font-size: 1.1rem;
  margin: 1.75rem 0 0.75rem;
}

p {
  margin: 0 0 1rem;
}

.aviso {
  border-radius: 0.5rem;
  padding: 0.65rem 0.85rem;
  margin: 0 0 1rem;
  border: 1px solid transparent;
}

.aviso-error {
  color: var(--error);
  background: var(--error-fondo);
  border-color: currentColor;
}

.aviso-exito {
  color: var(--exito);
  background: var(--exito-fondo);
  border-color: currentColor;
}

.aviso-aviso {
  color: var(--tinta);
  background: #fff7e0;
  border-color: #e0b13a;
}

@media (prefers-color-scheme: dark) {
  .aviso-aviso {
    background: #3a2f10;
    border-color: #b98a20;
  }
}

.ayuda {
  display: block;
  margin-top: 0.3rem;
  color: var(--tinta-suave);
  font-size: 0.85rem;
}

.dato-fijo {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  color: var(--tinta-suave);
}

.campo select {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: var(--fondo);
  color: var(--tinta);
  font: inherit;
}

.campo {
  display: block;
  margin: 0 0 1rem;
}

.campo span {
  display: block;
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.campo input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: var(--fondo);
  color: var(--tinta);
  font: inherit;
}

.campo input:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}

.boton {
  display: inline-block;
  padding: 0.6rem 1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: var(--acento);
  color: var(--acento-tinta);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.boton:hover {
  filter: brightness(1.08);
}

.boton-secundario {
  background: transparent;
  color: var(--tinta);
  border-color: var(--borde);
}

.boton-salir {
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  cursor: pointer;
}

.datos {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
  margin: 0 0 1rem;
}

.datos dt {
  color: var(--tinta-suave);
}

.datos dd {
  margin: 0;
}

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
  background: #ffffff;
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

.boton-mini {
  display: inline-block;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--borde);
  border-radius: 0.4rem;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.boton-mini:hover {
  border-color: var(--acento);
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

.insignia {
  display: inline-block;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 0.75rem;
  font-weight: 600;
}

.insignia-ok {
  color: var(--exito);
}

.insignia-retirado {
  color: var(--tinta-suave);
}

.insignia-agotado {
  color: var(--error);
}

.grupo {
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  padding: 0.75rem 0.9rem;
  margin: 0 0 1rem;
}

.grupo legend {
  font-weight: 600;
  padding: 0 0.35rem;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.2rem 0;
}

.casilla input {
  width: auto;
}

.campo-en-linea {
  max-width: 12rem;
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

.comensal-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
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
  background: #fff7e0;
  border-color: #e0b13a;
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

.boton-grande {
  width: 100%;
  padding: 0.9rem 1rem;
  font-size: 1.05rem;
  margin-top: 0.5rem;
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

@media (prefers-color-scheme: dark) {
  .emparejamiento-espera {
    background: #3a2f10;
    border-color: #b98a20;
  }
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
`
