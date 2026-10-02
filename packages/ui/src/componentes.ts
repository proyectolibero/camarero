/**
 * Los componentes basicos del sistema: solo los que ya se usan.
 *
 * Ninguno escribe un color: todos usan los alias de `temas.ts`. Si un componente necesita un
 * color que no existe, se anade un alias, no un hex. Los nombres de clase son el contrato con
 * las pantallas del panel y del comensal; cambiarlos es cambiar el contrato.
 */

/** Nombres de componente que el sistema garantiza. Se comprueba que existan en el CSS. */
export const CLASES_COMPONENTE: Readonly<Record<string, string>> = {
  boton: "boton",
  botonSecundario: "boton-secundario",
  botonMini: "boton-mini",
  botonGrande: "boton-grande",
  tarjeta: "tarjeta",
  insignia: "insignia",
  tabla: "tabla",
  campo: "campo",
  casilla: "casilla",
  aviso: "aviso",
}

export const COMPONENTES_CSS = `* {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--fondo);
  color: var(--texto);
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
  background: var(--superficie);
  border-bottom: 1px solid var(--borde);
}

.cabecera .marca {
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* El logo del local en la cabecera del panel: pequeno, en linea con la marca. */
.cabecera-logo {
  height: 1.7rem;
  width: auto;
  max-width: 7rem;
  object-fit: contain;
  border-radius: 0.3rem;
}

.cabecera .quien {
  color: var(--texto-suave);
}

.cabecera .quien strong {
  color: var(--texto);
}

.crece {
  flex: 1 1 auto;
}

.contenedor {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}

.tarjeta {
  background: var(--superficie);
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
  color: var(--texto);
  background: var(--aviso-fondo);
  border-color: var(--aviso-borde);
}

/* El aviso de emparejamientos usa el ambar de los avisos, ya presente en la piel. */
.aviso-emparejamientos {
  border-color: var(--aviso-borde);
}

.ayuda {
  display: block;
  margin-top: 0.3rem;
  color: var(--texto-suave);
  font-size: 0.85rem;
}

.dato-fijo {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  color: var(--texto-suave);
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

.campo input,
.campo select,
.campo textarea {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: var(--fondo);
  color: var(--texto);
  font: inherit;
}

.campo input:focus-visible,
.campo select:focus-visible,
.campo textarea:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 1px;
}

.campo-en-linea {
  max-width: 12rem;
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

.boton {
  display: inline-block;
  padding: 0.6rem 1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: var(--acento);
  color: var(--sobre-acento);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.boton:hover {
  filter: brightness(1.08);
}

.boton-secundario {
  background: transparent;
  color: var(--texto);
  border-color: var(--borde);
  text-decoration: none;
}

.boton-salir {
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--texto);
  font: inherit;
  cursor: pointer;
}

.boton-mini {
  display: inline-block;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--borde);
  border-radius: 0.4rem;
  background: transparent;
  color: var(--texto);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}

.boton-mini:hover {
  border-color: var(--acento);
}

.boton-grande {
  width: 100%;
  padding: 0.9rem 1rem;
  font-size: 1.05rem;
  margin-top: 0.5rem;
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
  color: var(--texto-suave);
}

.insignia-agotado {
  color: var(--error);
}

.insignia-aviso {
  color: var(--texto);
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--borde);
  border-radius: 0.5rem;
  overflow: hidden;
}

.tabla th,
.tabla td {
  padding: 0.55rem 0.9rem;
  text-align: left;
  border-top: 1px solid var(--borde);
}

.tabla thead th {
  border-top: 0;
  background: var(--superficie-tenue);
  font-size: 0.85rem;
}

.tabla tbody tr:first-child td {
  border-top: 0;
}

.datos {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
  margin: 0 0 1rem;
}

.datos dt {
  color: var(--texto-suave);
}

.datos dd {
  margin: 0;
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
`
