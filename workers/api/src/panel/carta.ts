/**
 * La carta en el panel del local: categorias, platos, bebidas y fotos (TASK-F1-05).
 *
 * Toda mutacion entra por POST y vuelve con una redireccion (PRG). Las fotos entran por POST
 * multipart (`request.formData()`) y se validan por CONTENIDO, no por el nombre del fichero
 * (ADR-0030). La pantalla solo decide que se dibuja: la cerradura de verdad es la RLS; aqui se
 * comprueba igual para dar un 403 claro en lugar de un cambio silencioso de cero filas.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import { SIN_CATEGORIA } from "./carta-catalogo.ts"
import {
  type AlmacenCartas,
  claveNueva,
  LIMITE_CABECERA_BYTES,
  LIMITE_CUERPO_BYTES,
  LIMITE_FOTO_BYTES,
  type TipoDeImagen,
  tipoDeImagen,
} from "./cartas.ts"
import type { Categoria, EntradaPlato, MotivoDeFallo, Plato, Puesto } from "./datos.ts"
import { puedeGestionarCarta } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import {
  invalido,
  type Validacion,
  validarAllergenos,
  validarDescripcion,
  validarHora,
  validarNombre,
  validarOrden,
  validarPrecio,
  validarPuesto,
  validarTags,
  validarVentana,
  valido,
} from "./validacion.ts"
import {
  type BorradorPlato,
  type EstadoPantalla,
  type InicialesPlato,
  vistaAviso,
  vistaCarta,
  vistaCategoria,
  vistaEntrada,
  vistaPlato,
  vistaSinPermiso,
} from "./vistas.ts"

export { SIN_CATEGORIA } from "./carta-catalogo.ts"

const MENSAJE_FOTO_GRANDE = "La foto no puede pasar de 5 MB. Redúcela o recórtala antes de subirla."
const MENSAJE_FOTO_INVALIDA =
  "Ese archivo no es una imagen válida. Solo se aceptan fotos en JPEG, PNG o WebP (no SVG)."
const MENSAJE_FOTO_FALTA = "Adjunta un archivo de imagen para subirlo."

type Campos = Readonly<Record<string, readonly string[]>>

/** Lee un formulario urlencoded conservando TODOS los valores de cada clave (casillas). */
async function leerCampos(peticion: Request): Promise<Campos> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return {}
  }
  const datos = new URLSearchParams(await peticion.text())
  const campos: Record<string, string[]> = {}
  for (const [clave, valor] of datos) {
    const lista = campos[clave]
    if (lista === undefined) {
      campos[clave] = [valor]
    } else {
      lista.push(valor)
    }
  }
  return campos
}

function primer(campos: Campos, clave: string): string {
  return campos[clave]?.[0]?.trim() ?? ""
}

function marcado(campos: Campos, clave: string): boolean {
  return campos[clave] !== undefined
}

function mensajeDeFallo(resultado: { readonly motivo: MotivoDeFallo }, accion: string): string {
  if (resultado.motivo === "conflicto") {
    return `No se pudo ${accion}: ya existe otro registro con ese nombre.`
  }
  if (resultado.motivo === "sin_permiso") {
    return `No tienes permiso para ${accion}.`
  }
  return `No se pudo ${accion}: el registro ya no existe o no es de tu local.`
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

async function renderCarta(
  empleado: Empleado,
  almacen: Dependencias["almacen"],
  estado: EstadoPantalla & { readonly creada?: boolean },
): Promise<Response> {
  const categorias = await almacen.listarCategorias(empleado)
  const puestos = await almacen.listarPuestos(empleado)
  const vista = vistaCarta(empleado, categorias, puestos, puedeGestionarCarta(empleado), estado)
  return respuestaHtml(renderizar(vista), estado.estadoError ?? 200)
}

async function crearCategoria(
  peticion: Request,
  empleado: Empleado,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "crear categorías")), 403)
  }
  const nombre = validarNombre(
    "nombre de la categoría",
    primer(await leerCampos(peticion), "nombre"),
  )
  if (!nombre.ok) {
    return await renderCarta(empleado, almacen, { error: nombre.error, estadoError: 400 })
  }
  const resultado = await almacen.crearCategoria(empleado, { nombre: nombre.valor })
  if (!resultado.ok) {
    const estadoError = resultado.motivo === "sin_permiso" ? 403 : 409
    return await renderCarta(empleado, almacen, {
      error: mensajeDeFallo(resultado, "crear la categoría"),
      estadoError,
    })
  }
  return responderRedireccion("/admin/carta?creada=1")
}

async function cambiarCategoria(
  peticion: Request,
  empleado: Empleado,
  categoriaId: string,
  almacen: Dependencias["almacen"],
  accion: "alternar" | "renombrar" | "mover",
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "cambiar la carta")), 403)
  }
  if (accion === "alternar") {
    const resultado = await almacen.alternarCategoria(empleado, categoriaId)
    return await responderCambioCategoria(resultado, empleado, almacen)
  }
  const campos = await leerCampos(peticion)
  if (accion === "renombrar") {
    const nombre = validarNombre("nombre de la categoría", primer(campos, "nombre"))
    if (!nombre.ok) {
      return await renderCarta(empleado, almacen, { error: nombre.error, estadoError: 400 })
    }
    const resultado = await almacen.renombrarCategoria(empleado, categoriaId, nombre.valor)
    return await responderCambioCategoria(resultado, empleado, almacen)
  }
  const direccion = primer(campos, "direccion")
  if (direccion !== "subir" && direccion !== "bajar") {
    return await renderCarta(empleado, almacen, {
      error: "Esa dirección no es válida.",
      estadoError: 400,
    })
  }
  const resultado = await almacen.moverCategoria(empleado, categoriaId, direccion)
  return await responderCambioCategoria(resultado, empleado, almacen)
}

async function responderCambioCategoria(
  resultado: { readonly ok: boolean; readonly motivo?: MotivoDeFallo },
  empleado: Empleado,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (resultado.ok) {
    return responderRedireccion("/admin/carta?cambiada=1")
  }
  const motivo = resultado.motivo ?? "no_existe"
  const estadoError = motivo === "sin_permiso" ? 403 : motivo === "conflicto" ? 409 : 404
  return await renderCarta(empleado, almacen, {
    error: mensajeDeFallo({ motivo }, "cambiar la categoría"),
    estadoError,
  })
}

/** Fija el puesto por defecto de una categoría. Todas sus fichas lo heredan (ADR-0034). */
async function cambiarPuestoCategoria(
  peticion: Request,
  empleado: Empleado,
  categoriaId: string,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "cambiar la carta")), 403)
  }
  const bruto = primer(await leerCampos(peticion), "puesto")
  const puestoId = bruto === "" ? null : bruto
  if (puestoId !== null) {
    const puestos = await almacen.listarPuestos(empleado)
    if (!puestos.some((puesto) => puesto.id === puestoId)) {
      return await renderCarta(empleado, almacen, {
        error: "Ese puesto no es de tu local.",
        estadoError: 400,
      })
    }
  }
  const resultado = await almacen.fijarPuestoCategoria(empleado, categoriaId, puestoId)
  if (!resultado.ok) {
    return await renderCarta(empleado, almacen, {
      error: mensajeDeFallo(resultado, "cambiar el puesto de la categoría"),
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 404,
    })
  }
  return responderRedireccion(`/admin/carta/${categoriaId}?cambiada=1`)
}

async function mostrarCategoria(
  url: URL,
  empleado: Empleado,
  categoriaId: string,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  const sinCategoria = categoriaId === SIN_CATEGORIA
  const categoria = sinCategoria
    ? {
        id: SIN_CATEGORIA,
        nombre: "Sin categoría",
        orden: 0,
        activa: true,
        disponible: true,
        puestoId: null,
      }
    : await almacen.leerCategoria(empleado, categoriaId)
  if (categoria === null) {
    const aviso = vistaAviso(
      empleado,
      "Categoría no encontrada",
      "Esa categoría no existe o no es de un local que puedas gestionar.",
    )
    return respuestaHtml(renderizar(aviso), 404)
  }
  const platos = await almacen.listarPlatos(empleado, sinCategoria ? null : categoriaId)
  const puestos = await almacen.listarPuestos(empleado)
  const cambiada = url.searchParams.get("cambiada") === "1"
  const estado: EstadoPantalla = cambiada ? { exito: "Carta actualizada." } : {}
  const vista = vistaCategoria(
    empleado,
    categoria,
    platos,
    puestos,
    puedeGestionarCarta(empleado),
    estado,
  )
  return respuestaHtml(renderizar(vista), 200)
}

// ---------------------------------------------------------------------------
// Platos y bebidas
// ---------------------------------------------------------------------------

function validarPlato(
  campos: Campos,
  categorias: readonly Categoria[],
  puestos: readonly Puesto[],
): Validacion<EntradaPlato> {
  const nombre = validarNombre("nombre", primer(campos, "nombre"))
  if (!nombre.ok) {
    return nombre
  }
  const descripcion = validarDescripcion(primer(campos, "descripcion"))
  if (!descripcion.ok) {
    return descripcion
  }
  const precio = validarPrecio(primer(campos, "precio"))
  if (!precio.ok) {
    return precio
  }
  const categoriaBruta = primer(campos, "categoria")
  const categoriaId =
    categoriaBruta === "" || categoriaBruta === SIN_CATEGORIA ? null : categoriaBruta
  if (categoriaId !== null && !categorias.some((categoria) => categoria.id === categoriaId)) {
    return invalido("Esa categoría no existe en tu local.")
  }
  const puesto = validarPuesto(
    primer(campos, "puesto"),
    puestos.map((p) => p.id),
  )
  if (!puesto.ok) {
    return puesto
  }
  const desde = validarHora("inicio", primer(campos, "desde"))
  if (!desde.ok) {
    return desde
  }
  const hasta = validarHora("fin", primer(campos, "hasta"))
  if (!hasta.ok) {
    return hasta
  }
  const ventana = validarVentana(desde.valor, hasta.valor)
  if (!ventana.ok) {
    return ventana
  }
  const tags = validarTags(campos["tags"] ?? [])
  if (!tags.ok) {
    return tags
  }
  const allergens = validarAllergenos(campos["alergenos"] ?? [])
  if (!allergens.ok) {
    return allergens
  }
  const orden = validarOrden(primer(campos, "orden") === "" ? "0" : primer(campos, "orden"))
  if (!orden.ok) {
    return orden
  }
  return valido({
    categoriaId,
    nombre: nombre.valor,
    descripcion: descripcion.valor,
    precioClp: precio.valor,
    allergens: allergens.valor,
    tags: tags.valor,
    puestoId: puesto.valor,
    disponible: marcado(campos, "disponible"),
    desde: desde.valor,
    hasta: hasta.valor,
    orden: orden.valor,
    activo: marcado(campos, "activo"),
  })
}

async function renderPlato(
  empleado: Empleado,
  plato: Plato | null,
  almacen: Dependencias["almacen"],
  estado: EstadoPantalla,
  iniciales: InicialesPlato = { categoria: null, puestoId: null, bebida: false },
  borrador: BorradorPlato | null = null,
): Promise<Response> {
  const categorias = await almacen.listarCategorias(empleado)
  const puestos = await almacen.listarPuestos(empleado)
  const vista = vistaPlato(empleado, plato, categorias, puestos, iniciales, estado, borrador)
  return respuestaHtml(renderizar(vista), estado.estadoError ?? 200)
}

/**
 * Alta de un plato o bebida. La foto entra en el MISMO envio (multipart) y se valida ANTES de
 * crear nada: si la imagen no vale o pasa de tamano, no se crea el plato y se devuelve el
 * formulario con lo que el dueno ya habia escrito. Crear a medias o perder el formulario es
 * inaceptable.
 */
async function crearPlato(
  peticion: Request,
  empleado: Empleado,
  almacen: Dependencias["almacen"],
  cartas: AlmacenCartas,
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "crear platos")), 403)
  }
  const formulario = await leerFormularioPlato(peticion)
  const iniciales = inicialesDeCampos(formulario.campos)
  const borrador = borradorDeCampos(formulario.campos)
  const categorias = await almacen.listarCategorias(empleado)
  const puestos = await almacen.listarPuestos(empleado)
  const validado = validarPlato(formulario.campos, categorias, puestos)
  if (!validado.ok) {
    return await renderPlato(
      empleado,
      null,
      almacen,
      { error: validado.error, estadoError: 400 },
      iniciales,
      borrador,
    )
  }
  const foto = await revisarFoto(formulario.archivo)
  if (!foto.ok) {
    return await renderPlato(
      empleado,
      null,
      almacen,
      { error: foto.error, estadoError: foto.estado },
      iniciales,
      borrador,
    )
  }
  const resultado = await almacen.crearPlato(empleado, validado.valor)
  if (!resultado.ok) {
    const estadoError = resultado.motivo === "sin_permiso" ? 403 : 409
    return await renderPlato(
      empleado,
      null,
      almacen,
      { error: mensajeDeFallo(resultado, "crear el registro"), estadoError },
      iniciales,
      borrador,
    )
  }
  if (foto.valor !== null) {
    const fallo = await guardarFotoDePlato(
      resultado.valor.id,
      foto.valor,
      almacen,
      cartas,
      empleado,
    )
    if (fallo !== null) {
      return await renderPlato(
        empleado,
        resultado.valor,
        almacen,
        { error: fallo, estadoError: 500 },
        iniciales,
        null,
      )
    }
  }
  if (primer(formulario.campos, "continuar") === "otro") {
    return responderRedireccion(
      urlDeSeguir(validado.valor.categoriaId, validado.valor.puestoId, iniciales.bebida),
    )
  }
  return responderRedireccion(urlDeCategoria(validado.valor.categoriaId))
}

/** Conserva categoría y puesto al encadenar altas: teclear ochenta bebidas seguidas. */
function urlDeSeguir(categoriaId: string | null, puestoId: string | null, bebida: boolean): string {
  const parametros = new URLSearchParams()
  if (categoriaId !== null) {
    parametros.set("categoria", categoriaId)
  }
  if (puestoId !== null) {
    parametros.set("puesto", puestoId)
  }
  if (bebida) {
    parametros.set("bebida", "1")
  }
  parametros.set("continuar", "1")
  return `/admin/carta/plato?${parametros.toString()}`
}

function urlDeCategoria(categoriaId: string | null): string {
  return categoriaId === null
    ? `/admin/carta/${SIN_CATEGORIA}?cambiada=1`
    : `/admin/carta/${categoriaId}?cambiada=1`
}

async function guardarPlato(
  peticion: Request,
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "editar platos")), 403)
  }
  const actual = await almacen.leerPlato(empleado, platoId)
  if (actual === null) {
    return respuestaHtml(
      renderizar(vistaAviso(empleado, "Plato no encontrado", "Ese plato ya no existe.")),
      404,
    )
  }
  const categorias = await almacen.listarCategorias(empleado)
  const puestos = await almacen.listarPuestos(empleado)
  const validado = validarPlato(await leerCampos(peticion), categorias, puestos)
  if (!validado.ok) {
    return await renderPlato(empleado, actual, almacen, {
      error: validado.error,
      estadoError: 400,
    })
  }
  const resultado = await almacen.actualizarPlato(empleado, platoId, validado.valor)
  if (!resultado.ok) {
    const estadoError = resultado.motivo === "sin_permiso" ? 403 : 404
    return await renderPlato(empleado, actual, almacen, {
      error: mensajeDeFallo(resultado, "guardar el plato"),
      estadoError,
    })
  }
  return responderRedireccion(`/admin/carta/plato/${platoId}?guardado=1`)
}

/** Copia una ficha con el nombre acabado en «(copia)» y, si la tiene, copia tambien la foto. */
async function duplicarPlato(
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
  cartas: AlmacenCartas,
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "duplicar platos")), 403)
  }
  const original = await almacen.leerPlato(empleado, platoId)
  if (original === null) {
    return respuestaHtml(
      renderizar(vistaAviso(empleado, "Plato no encontrado", "Ese plato ya no existe.")),
      404,
    )
  }
  const copia: EntradaPlato = {
    categoriaId: original.categoriaId,
    nombre: `${original.nombre} (copia)`,
    descripcion: original.descripcion,
    precioClp: original.precioClp,
    allergens: original.allergens,
    tags: original.tags,
    puestoId: original.puestoId,
    disponible: original.disponible,
    desde: original.desde,
    hasta: original.hasta,
    orden: original.orden,
    activo: original.activo,
  }
  const resultado = await almacen.crearPlato(empleado, copia)
  if (!resultado.ok) {
    return await renderPlato(empleado, original, almacen, {
      error: mensajeDeFallo(resultado, "duplicar el plato"),
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 409,
    })
  }
  await copiarFoto(original, resultado.valor.id, almacen, cartas, empleado)
  return responderRedireccion(urlDeCategoria(original.categoriaId))
}

/** Duplica el objeto de R2 bajo una clave nueva: dos fichas nunca comparten una foto. */
async function copiarFoto(
  original: Plato,
  nuevoId: string,
  almacen: Dependencias["almacen"],
  cartas: AlmacenCartas,
  empleado: Empleado,
): Promise<void> {
  if (original.fotoClave === null || !cartas.disponible) {
    return
  }
  const foto = await cartas.leer(original.fotoClave)
  if (foto === null) {
    return
  }
  const bytes = new Uint8Array(await new Response(foto.cuerpo).arrayBuffer())
  const tipo = tipoDeImagen(bytes)
  if (tipo === null) {
    return
  }
  const clave = claveNueva(tipo)
  await cartas.guardar(clave, bytes, tipo)
  await almacen.fijarFoto(empleado, nuevoId, clave)
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

/** Lo minimo que necesitamos de un `File` subido, sin depender del tipo global. */
type ArchivoSubido = {
  readonly size: number
  readonly slice: (
    inicio: number,
    fin: number,
  ) => { readonly arrayBuffer: () => Promise<ArrayBuffer> }
  readonly arrayBuffer: () => Promise<ArrayBuffer>
}

function esArchivo(valor: unknown): valor is ArchivoSubido {
  return (
    typeof valor === "object" &&
    valor !== null &&
    "arrayBuffer" in valor &&
    "size" in valor &&
    "slice" in valor
  )
}

type FormularioPlato = {
  readonly campos: Campos
  readonly archivo: ArchivoSubido | null
}

/**
 * Lee el formulario de alta. Acepta multipart (cuando lleva foto) y `urlencoded` (altas sin
 * foto): un solo camino para el alta, sin exigir una codificacion concreta.
 */
async function leerFormularioPlato(peticion: Request): Promise<FormularioPlato> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("multipart/form-data")) {
    return { campos: await leerCampos(peticion), archivo: null }
  }
  let formulario: FormData
  try {
    formulario = await peticion.formData()
  } catch {
    // Cuerpo multipart mal formado: se trata como formulario vacío, sin archivo.
    return { campos: {}, archivo: null }
  }
  const campos: Record<string, string[]> = {}
  let archivo: ArchivoSubido | null = null
  for (const [clave, valor] of formulario) {
    if (esArchivo(valor)) {
      if (clave === "foto" && valor.size > 0) {
        archivo = valor
      }
      continue
    }
    const lista = campos[clave]
    if (lista === undefined) {
      campos[clave] = [String(valor)]
    } else {
      lista.push(String(valor))
    }
  }
  return { campos, archivo }
}

function borradorDeCampos(campos: Campos): BorradorPlato {
  return {
    nombre: primer(campos, "nombre"),
    descripcion: primer(campos, "descripcion"),
    precio: primer(campos, "precio"),
    categoria: primer(campos, "categoria"),
    puesto: primer(campos, "puesto"),
    disponible: marcado(campos, "disponible"),
    activo: marcado(campos, "activo"),
    desde: primer(campos, "desde"),
    hasta: primer(campos, "hasta"),
    orden: primer(campos, "orden"),
    tags: campos["tags"] ?? [],
    allergens: campos["alergenos"] ?? [],
  }
}

function inicialesDeCampos(campos: Campos): InicialesPlato {
  const categoriaBruta = primer(campos, "categoria")
  const puesto = primer(campos, "puesto")
  return {
    categoria: categoriaBruta === "" || categoriaBruta === SIN_CATEGORIA ? null : categoriaBruta,
    puestoId: puesto === "" ? null : puesto,
    bebida: marcado(campos, "bebida"),
  }
}

type FotoRevisada = {
  readonly tipo: TipoDeImagen
  readonly bytes: () => Promise<Uint8Array>
}

type RevisionFoto =
  | { readonly ok: true; readonly valor: FotoRevisada | null }
  | { readonly ok: false; readonly error: string; readonly estado: number }

/** Valida la imagen antes de crear nada: tamano y contenido, nunca el nombre del fichero. */
async function revisarFoto(archivo: ArchivoSubido | null): Promise<RevisionFoto> {
  if (archivo === null) {
    return { ok: true, valor: null }
  }
  if (archivo.size > LIMITE_FOTO_BYTES) {
    return { ok: false, error: MENSAJE_FOTO_GRANDE, estado: 413 }
  }
  const cabecera = new Uint8Array(await archivo.slice(0, LIMITE_CABECERA_BYTES).arrayBuffer())
  const tipo = tipoDeImagen(cabecera)
  if (tipo === null) {
    return { ok: false, error: MENSAJE_FOTO_INVALIDA, estado: 415 }
  }
  return {
    ok: true,
    valor: { tipo, bytes: async () => new Uint8Array(await archivo.arrayBuffer()) },
  }
}

/**
 * Guarda la foto DESPUES de crear el plato y la enlaza. Si algo falla, devuelve el mensaje que
 * se le ensena al dueno: el plato se queda sin foto, nunca se borra en silencio.
 */
async function guardarFotoDePlato(
  platoId: string,
  foto: FotoRevisada,
  almacen: Dependencias["almacen"],
  cartas: AlmacenCartas,
  empleado: Empleado,
): Promise<string | null> {
  if (!cartas.disponible) {
    return "Se creó, pero no se pudo guardar la foto: el almacén de fotos no está configurado. Súbela de nuevo desde la ficha cuando esté disponible."
  }
  const clave = claveNueva(foto.tipo)
  try {
    await cartas.guardar(clave, await foto.bytes(), foto.tipo)
  } catch {
    return "Se creó, pero la foto no se pudo guardar. Vuelve a intentarlo desde la ficha del plato."
  }
  const resultado = await almacen.fijarFoto(empleado, platoId, clave)
  if (!resultado.ok) {
    await cartas.borrar(clave)
    return "Se creó, pero la foto no se pudo enlazar. Vuelve a intentarlo desde la ficha del plato."
  }
  if (resultado.valor !== null && resultado.valor !== clave) {
    await cartas.borrar(resultado.valor)
  }
  return null
}

function respuestaDeFoto(
  empleado: Empleado,
  plato: Plato | null,
  almacen: Dependencias["almacen"],
  mensaje: string,
  estado: number,
): Promise<Response> {
  return renderPlato(empleado, plato, almacen, { error: mensaje, estadoError: estado })
}

async function subirFoto(
  peticion: Request,
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
  cartas: AlmacenCartas,
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "subir fotos")), 403)
  }
  const plato = await almacen.leerPlato(empleado, platoId)
  if (plato === null) {
    return respuestaHtml(
      renderizar(vistaAviso(empleado, "Plato no encontrado", "Ese plato ya no existe.")),
      404,
    )
  }
  if (!cartas.disponible) {
    return await respuestaDeFoto(
      empleado,
      plato,
      almacen,
      "El almacén de fotos no está configurado. Avisa a quien administra el sistema.",
      503,
    )
  }
  const largo = Number.parseInt(peticion.headers.get("content-length") ?? "", 10)
  if (Number.isFinite(largo) && largo > LIMITE_CUERPO_BYTES) {
    return await respuestaDeFoto(empleado, plato, almacen, MENSAJE_FOTO_GRANDE, 413)
  }
  const archivo = await archivoDe(peticion)
  if (archivo === null) {
    return await respuestaDeFoto(empleado, plato, almacen, MENSAJE_FOTO_FALTA, 400)
  }
  if (archivo.size > LIMITE_FOTO_BYTES) {
    return await respuestaDeFoto(empleado, plato, almacen, MENSAJE_FOTO_GRANDE, 413)
  }
  const tipo = tipoDeImagen(
    new Uint8Array(await archivo.slice(0, LIMITE_CABECERA_BYTES).arrayBuffer()),
  )
  if (tipo === null) {
    return await respuestaDeFoto(empleado, plato, almacen, MENSAJE_FOTO_INVALIDA, 415)
  }
  const clave = claveNueva(tipo)
  await cartas.guardar(clave, new Uint8Array(await archivo.arrayBuffer()), tipo)
  const resultado = await almacen.fijarFoto(empleado, platoId, clave)
  if (!resultado.ok) {
    await cartas.borrar(clave)
    return await respuestaDeFoto(
      empleado,
      plato,
      almacen,
      mensajeDeFallo(resultado, "guardar la foto"),
      resultado.motivo === "sin_permiso" ? 403 : 404,
    )
  }
  if (resultado.valor !== null && resultado.valor !== clave) {
    await cartas.borrar(resultado.valor)
  }
  return responderRedireccion(`/admin/carta/plato/${platoId}?guardado=1`)
}

async function archivoDe(peticion: Request): Promise<ArchivoSubido | null> {
  try {
    const formulario = await peticion.formData()
    const valor = formulario.get("foto")
    return esArchivo(valor) && valor.size > 0 ? valor : null
  } catch {
    // Un cuerpo que no es multipart o esta mal formado: se trata como "no hay archivo".
    return null
  }
}

async function borrarFoto(
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
  cartas: AlmacenCartas,
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "quitar fotos")), 403)
  }
  const resultado = await almacen.fijarFoto(empleado, platoId, null)
  if (!resultado.ok) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "quitar la foto")), 404)
  }
  if (resultado.valor !== null && cartas.disponible) {
    await cartas.borrar(resultado.valor)
  }
  return responderRedireccion(`/admin/carta/plato/${platoId}?guardado=1`)
}

async function alternarPlato(
  peticion: Request,
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "cambiar un plato")), 403)
  }
  const campo = primer(await leerCampos(peticion), "campo")
  if (campo !== "activo" && campo !== "disponible") {
    return await renderAvisoPlato(empleado, "Ese cambio no es válido.", 400, almacen, platoId)
  }
  const resultado = await almacen.alternarPlato(empleado, platoId, campo)
  if (!resultado.ok) {
    return await renderAvisoPlato(empleado, "Ese plato ya no existe.", 404, almacen, platoId)
  }
  return await redirigirACategoriaDe(empleado, platoId, almacen)
}

async function moverPlato(
  peticion: Request,
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "ordenar un plato")), 403)
  }
  const direccion = primer(await leerCampos(peticion), "direccion")
  if (direccion !== "subir" && direccion !== "bajar") {
    return await renderAvisoPlato(empleado, "Esa dirección no es válida.", 400, almacen, platoId)
  }
  const resultado = await almacen.moverPlato(empleado, platoId, direccion)
  if (!resultado.ok) {
    return await renderAvisoPlato(empleado, "Ese plato ya no existe.", 404, almacen, platoId)
  }
  return await redirigirACategoriaDe(empleado, platoId, almacen)
}

async function renderAvisoPlato(
  empleado: Empleado,
  mensaje: string,
  estado: number,
  almacen: Dependencias["almacen"],
  platoId: string,
): Promise<Response> {
  const plato = await almacen.leerPlato(empleado, platoId)
  return await renderPlato(empleado, plato, almacen, { error: mensaje, estadoError: estado })
}

async function redirigirACategoriaDe(
  empleado: Empleado,
  platoId: string,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  const plato = await almacen.leerPlato(empleado, platoId)
  return responderRedireccion(urlDeCategoria(plato?.categoriaId ?? null))
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------

type RutaCarta =
  | { readonly tipo: "indice" }
  | { readonly tipo: "categoria"; readonly categoriaId: string }
  | { readonly tipo: "mover_categoria"; readonly categoriaId: string }
  | { readonly tipo: "renombrar_categoria"; readonly categoriaId: string }
  | { readonly tipo: "alternar_categoria"; readonly categoriaId: string }
  | { readonly tipo: "puesto_categoria"; readonly categoriaId: string }
  | { readonly tipo: "nuevo_plato" }
  | { readonly tipo: "editar_plato"; readonly platoId: string }
  | { readonly tipo: "duplicar_plato"; readonly platoId: string }
  | { readonly tipo: "alternar_plato"; readonly platoId: string }
  | { readonly tipo: "mover_plato"; readonly platoId: string }
  | { readonly tipo: "subir_foto"; readonly platoId: string }
  | { readonly tipo: "borrar_foto"; readonly platoId: string }

function reconocer(segmentos: readonly string[]): RutaCarta | null {
  if (segmentos[0] !== "admin" || segmentos[1] !== "carta") {
    return null
  }
  const resto = segmentos.slice(2)
  if (resto.length === 0) {
    return { tipo: "indice" }
  }
  const [primero, segundo, tercero, cuarto] = resto
  if (primero === "plato") {
    if (segundo === undefined) {
      return { tipo: "nuevo_plato" }
    }
    if (resto.length === 2) {
      return { tipo: "editar_plato", platoId: segundo }
    }
    if (resto.length === 3 && tercero === "duplicar") {
      return { tipo: "duplicar_plato", platoId: segundo }
    }
    if (resto.length === 3 && tercero === "alternar") {
      return { tipo: "alternar_plato", platoId: segundo }
    }
    if (resto.length === 3 && tercero === "mover") {
      return { tipo: "mover_plato", platoId: segundo }
    }
    if (resto.length === 3 && tercero === "foto") {
      return { tipo: "subir_foto", platoId: segundo }
    }
    if (resto.length === 4 && tercero === "foto" && cuarto === "borrar") {
      return { tipo: "borrar_foto", platoId: segundo }
    }
    return null
  }
  if (primero === "categoria") {
    if (segundo === undefined || resto.length !== 3) {
      return null
    }
    if (tercero === "mover") {
      return { tipo: "mover_categoria", categoriaId: segundo }
    }
    if (tercero === "renombrar") {
      return { tipo: "renombrar_categoria", categoriaId: segundo }
    }
    if (tercero === "alternar") {
      return { tipo: "alternar_categoria", categoriaId: segundo }
    }
    if (tercero === "puesto") {
      return { tipo: "puesto_categoria", categoriaId: segundo }
    }
    return null
  }
  if (resto.length === 1 && primero !== undefined) {
    return { tipo: "categoria", categoriaId: primero }
  }
  return null
}

async function despachar(
  ruta: RutaCarta,
  peticion: Request,
  url: URL,
  empleado: Empleado,
  dependencias: Dependencias,
): Promise<Response> {
  const { almacen, cartas } = dependencias
  switch (ruta.tipo) {
    case "indice":
      if (peticion.method === "POST") {
        return await crearCategoria(peticion, empleado, almacen)
      }
      if (peticion.method !== "GET") {
        return responderMetodoNoPermitido("GET, POST")
      }
      return await renderCarta(empleado, almacen, {
        creada: url.searchParams.get("creada") === "1",
        exito: url.searchParams.get("cambiada") === "1" ? "Categoría actualizada." : undefined,
      })
    case "categoria":
      return peticion.method === "GET"
        ? await mostrarCategoria(url, empleado, ruta.categoriaId, almacen)
        : responderMetodoNoPermitido("GET")
    case "puesto_categoria":
      return peticion.method === "POST"
        ? await cambiarPuestoCategoria(peticion, empleado, ruta.categoriaId, almacen)
        : responderMetodoNoPermitido("POST")
    case "mover_categoria":
    case "renombrar_categoria":
    case "alternar_categoria": {
      if (peticion.method !== "POST") {
        return responderMetodoNoPermitido("POST")
      }
      const accion =
        ruta.tipo === "mover_categoria"
          ? "mover"
          : ruta.tipo === "renombrar_categoria"
            ? "renombrar"
            : "alternar"
      return await cambiarCategoria(peticion, empleado, ruta.categoriaId, almacen, accion)
    }
    case "nuevo_plato":
      if (peticion.method === "POST") {
        return await crearPlato(peticion, empleado, almacen, cartas)
      }
      if (peticion.method !== "GET") {
        return responderMetodoNoPermitido("GET, POST")
      }
      return await mostrarFormularioPlato(url, empleado, null, almacen)
    case "editar_plato":
      if (peticion.method === "POST") {
        return await guardarPlato(peticion, empleado, ruta.platoId, almacen)
      }
      if (peticion.method !== "GET") {
        return responderMetodoNoPermitido("GET, POST")
      }
      return await mostrarFormularioPlato(url, empleado, ruta.platoId, almacen)
    case "duplicar_plato":
      return peticion.method === "POST"
        ? await duplicarPlato(empleado, ruta.platoId, almacen, cartas)
        : responderMetodoNoPermitido("POST")
    case "alternar_plato":
      return peticion.method === "POST"
        ? await alternarPlato(peticion, empleado, ruta.platoId, almacen)
        : responderMetodoNoPermitido("POST")
    case "mover_plato":
      return peticion.method === "POST"
        ? await moverPlato(peticion, empleado, ruta.platoId, almacen)
        : responderMetodoNoPermitido("POST")
    case "subir_foto":
      return peticion.method === "POST"
        ? await subirFoto(peticion, empleado, ruta.platoId, almacen, cartas)
        : responderMetodoNoPermitido("POST")
    case "borrar_foto":
      return peticion.method === "POST"
        ? await borrarFoto(empleado, ruta.platoId, almacen, cartas)
        : responderMetodoNoPermitido("POST")
  }
}

async function mostrarFormularioPlato(
  url: URL,
  empleado: Empleado,
  platoId: string | null,
  almacen: Dependencias["almacen"],
): Promise<Response> {
  if (!puedeGestionarCarta(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "editar la carta")), 403)
  }
  if (platoId === null) {
    const categorias = await almacen.listarCategorias(empleado)
    const puestos = await almacen.listarPuestos(empleado)
    const iniciales = inicialesDeAlta(url)
    const continuar = url.searchParams.get("continuar") === "1"
    const estado: EstadoPantalla = continuar ? { exito: "Guardado. Puedes añadir otro." } : {}
    const vista = vistaPlato(empleado, null, categorias, puestos, iniciales, estado)
    return respuestaHtml(renderizar(vista), 200)
  }
  const plato = await almacen.leerPlato(empleado, platoId)
  if (plato === null) {
    return respuestaHtml(
      renderizar(vistaAviso(empleado, "Plato no encontrado", "Ese plato ya no existe.")),
      404,
    )
  }
  const categorias = await almacen.listarCategorias(empleado)
  const puestos = await almacen.listarPuestos(empleado)
  const guardado = url.searchParams.get("guardado") === "1"
  const vista = vistaPlato(
    empleado,
    plato,
    categorias,
    puestos,
    { categoria: null, puestoId: null, bebida: false },
    {
      exito: guardado ? "Guardado." : undefined,
    },
  )
  return respuestaHtml(renderizar(vista), 200)
}

/** Preselecciones del alta que llegan por la direccion: categoría, puesto y atajo de bebidas. */
function inicialesDeAlta(url: URL): InicialesPlato {
  const categoria = url.searchParams.get("categoria")
  const puesto = url.searchParams.get("puesto") ?? ""
  return {
    categoria: categoria === null || categoria === SIN_CATEGORIA ? null : categoria,
    puestoId: puesto === "" ? null : puesto,
    bebida: url.searchParams.get("bebida") === "1",
  }
}

/**
 * Devuelve la respuesta de una ruta de la carta, o null si la ruta no es de la carta. Se llama
 * antes que `manejarAdmin` para que su gramatica de rutas quede intacta.
 */
export async function manejarCarta(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const ruta = reconocer(url.pathname.split("/").filter((trozo) => trozo !== ""))
  if (ruta === null) {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), peticion.method === "GET" ? 200 : 401)
  }
  return await despachar(ruta, peticion, url, empleado, dependencias)
}
