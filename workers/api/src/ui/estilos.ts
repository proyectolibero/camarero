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
  font-size: 0.85rem;
}

.mesa-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  width: 100%;
}

.mesa-cabecera form {
  margin-left: auto;
}

/* El mapa no tiene JavaScript: se dibuja en el servidor y se adapta al ancho del movil. */
.mapa-svg {
  display: block;
  width: 100%;
  height: auto;
  max-width: 40rem;
  margin: 0 0 0.75rem;
}

.mapa-celda {
  fill: var(--fondo);
  stroke: var(--borde);
  stroke-width: 1;
}

.mapa-mesa {
  stroke: var(--papel);
  stroke-width: 2;
}

.mapa-mesa-activa {
  fill: var(--acento);
}

/* Sin fill en la hoja: manda el atributo con el patron de rayas. */
.mapa-mesa-inactiva {
  stroke: var(--tinta-suave);
  stroke-dasharray: 4 3;
}

.mapa-inactiva-fondo {
  fill: var(--tinta-suave);
}

.mapa-raya {
  stroke: var(--papel);
  stroke-width: 2;
}

.mapa-etiqueta {
  fill: var(--acento-tinta);
  font-size: 13px;
  font-weight: 600;
}

.mapa-etiqueta-inactiva {
  fill: var(--papel);
}

/* Botones grandes: se pulsan con el pulgar en un movil. La posicion va en el centro. */
.mover {
  display: grid;
  grid-template-columns: repeat(3, minmax(2.75rem, 3rem));
  grid-template-rows: repeat(3, auto);
  gap: 0.35rem;
  justify-content: center;
  margin-top: 0.6rem;
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

.mover-posicion {
  grid-area: 2 / 2 / 3 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tinta-suave);
  font-size: 0.8rem;
}

.mover-derecha {
  grid-area: 2 / 3 / 3 / 4;
}

.mover-abajo {
  grid-area: 3 / 2 / 4 / 3;
}

.plano li.mesa {
  display: block;
}

.mesa-inactiva {
  opacity: 0.6;
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
`
