/**
 * La cuenta en el panel: `GET /admin/cuentas`, `GET /admin/cuentas/<id>` y el POST que
 * registra el cobro (TASK-F3-01, D-039, CONTRACT-dinero).
 *
 * La pantalla decide que se dibuja; la cerradura de verdad es la RLS y la transaccion de
 * `almacen.cobrar`, que lee el consumo de la BASE y calcula el importe con la funcion unica
 * del dominio. El formulario NO manda importe: solo la forma de pago y la propina. Al
 * registrar el cobro, la cuenta queda con su `checkouts` y la mesa se cierra.
 */
import type { Empleado } from "../base.ts"
import { responderMetodoNoPermitido, responderNoEncontrado } from "../salud.ts"
import { renderizar } from "../ui/html.ts"
import { responderRedireccion, respuestaHtml } from "../ui/respuesta.ts"
import type { AlmacenPanel, DatosDeCobro, MotivoDeCobro } from "./datos.ts"
import { puedeOperarCocina, puedeRegistrarCobro } from "./permisos.ts"
import type { Dependencias } from "./proveedor.ts"
import { type EntornoDePanel, resolverEmpleadoDeSesion } from "./sesion-panel.ts"
import { type Validacion, validarFormaDePago, validarPropina } from "./validacion.ts"
import {
  type EstadoPantalla,
  vistaAviso,
  vistaCuenta,
  vistaCuentas,
  vistaEntrada,
  vistaSinPermiso,
} from "./vistas.ts"

/** Cada causa de fallo al cobrar tiene su mensaje: un fallo sin explicar es un fallo invisible. */
const MENSAJE_DE_COBRO: Readonly<Record<MotivoDeCobro, string>> = {
  sin_permiso: "No tienes permiso para registrar cobros.",
  no_existe: "Esa cuenta ya no existe o no es de tu local.",
  ya_cobrada: "Esa cuenta ya se cobró y la mesa está cerrada.",
  sin_sesion: "Esa mesa ya no tiene una sesión abierta que cobrar.",
}

async function renderCuenta(
  empleado: Empleado,
  cuentaId: string,
  almacen: AlmacenPanel,
  estado: EstadoPantalla,
): Promise<Response> {
  const cuentas = await almacen.listarCuentas(empleado)
  const cuenta = cuentas.find((candidata) => candidata.id === cuentaId)
  if (cuenta === undefined) {
    const aviso = vistaAviso(
      empleado,
      "Cuenta no encontrada",
      "Esa cuenta no existe o no es de un local que puedas ver.",
    )
    return respuestaHtml(renderizar(aviso), 404)
  }
  const comandas = await almacen.listarComandasDeMesa(empleado, cuenta.mesaId)
  return respuestaHtml(
    renderizar(vistaCuenta(empleado, cuenta, comandas, puedeRegistrarCobro(empleado), estado)),
    estado.estadoError ?? 200,
  )
}

async function mostrarCuentas(
  url: URL,
  empleado: Empleado,
  almacen: AlmacenPanel,
): Promise<Response> {
  const cuentas = await almacen.listarCuentas(empleado)
  return respuestaHtml(
    renderizar(
      vistaCuentas(empleado, cuentas, {
        cobrada: url.searchParams.get("cobrada") === "1",
      }),
    ),
    200,
  )
}

async function leerCampos(peticion: Request): Promise<Readonly<Record<string, string>>> {
  const tipo = peticion.headers.get("content-type") ?? ""
  if (!tipo.includes("application/x-www-form-urlencoded")) {
    return {}
  }
  const campos: Record<string, string> = {}
  for (const [clave, valor] of new URLSearchParams(await peticion.text())) {
    campos[clave] = valor
  }
  return campos
}

async function leerCobro(peticion: Request, cuentaId: string): Promise<Validacion<DatosDeCobro>> {
  const campos = await leerCampos(peticion)
  const formaDePago = validarFormaDePago(campos.forma_pago ?? "")
  if (!formaDePago.ok) {
    return formaDePago
  }
  const propina = validarPropina(campos.propina ?? "")
  if (!propina.ok) {
    return propina
  }
  return {
    ok: true,
    valor: { cuentaId, formaDePago: formaDePago.valor, tipPercent: propina.valor },
  }
}

async function registrarCobro(
  peticion: Request,
  empleado: Empleado,
  cuentaId: string,
  almacen: AlmacenPanel,
): Promise<Response> {
  if (!puedeRegistrarCobro(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "registrar cobros")), 403)
  }
  const cobro = await leerCobro(peticion, cuentaId)
  if (!cobro.ok) {
    return await renderCuenta(empleado, cuentaId, almacen, {
      error: cobro.error,
      estadoError: 400,
    })
  }
  const resultado = await almacen.cobrar(empleado, cobro.valor)
  if (!resultado.ok) {
    return await renderCuenta(empleado, cuentaId, almacen, {
      error: MENSAJE_DE_COBRO[resultado.motivo],
      estadoError: resultado.motivo === "sin_permiso" ? 403 : 409,
    })
  }
  return responderRedireccion("/admin/cuentas?cobrada=1")
}

/** Devuelve la respuesta de las cuentas, o null si la ruta no es la de cuentas. */
export async function manejarCuentas(
  peticion: Request,
  entorno: EntornoDePanel,
  ahora: Date,
  dependencias: Dependencias,
): Promise<Response | null> {
  const url = new URL(peticion.url)
  const segmentos = url.pathname.split("/").filter((trozo) => trozo !== "")
  if (segmentos[0] !== "admin" || segmentos[1] !== "cuentas") {
    return null
  }
  const empleado = await resolverEmpleadoDeSesion(peticion, entorno, ahora, dependencias)
  if (empleado === null) {
    return respuestaHtml(renderizar(vistaEntrada("admin")), peticion.method === "GET" ? 200 : 401)
  }
  if (!puedeOperarCocina(empleado)) {
    return respuestaHtml(renderizar(vistaSinPermiso(empleado, "ver las cuentas")), 403)
  }
  const almacen = dependencias.almacen
  if (segmentos.length === 2) {
    return peticion.method === "GET"
      ? await mostrarCuentas(url, empleado, almacen)
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 3) {
    const cuentaId = segmentos[2]
    if (cuentaId === undefined) {
      return responderNoEncontrado()
    }
    return peticion.method === "GET"
      ? await renderCuenta(empleado, cuentaId, almacen, {})
      : responderMetodoNoPermitido("GET")
  }
  if (segmentos.length === 4 && segmentos[3] === "cobrar") {
    const cuentaId = segmentos[2]
    if (cuentaId === undefined) {
      return responderNoEncontrado()
    }
    return peticion.method === "POST"
      ? await registrarCobro(peticion, empleado, cuentaId, almacen)
      : responderMetodoNoPermitido("POST")
  }
  return responderNoEncontrado()
}
