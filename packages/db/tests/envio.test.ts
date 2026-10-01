/**
 * El envio REAL del comensal, de punta a punta (TASK-F1-07, ADR-0033, LL-025).
 *
 * Las pruebas de borde sustituyen el envio y las de base insertan una comanda por puesto a
 * mano: ninguna ejercitaba `agruparPorDestino` junto con el envio de verdad. Aqui SI: se llama
 * al almacen del comensal del borde (`almacenComensalDeBase`) contra el Postgres efimero, con
 * una cesta de una parrilla y una bebida. Se comprueba que produce DOS comandas, cada una con
 * su puesto, que la de barra nace aceptada con los importes cerrados, y que reenviar con la
 * misma clave no crea cuatro comandas hermanas.
 *
 * Se conecta como `camarero_app` (nunca el propietario: LL-004). El almacen abre su propia
 * conexion a la base de pruebas y commitea, asi que cada guion LIMPIA sus comandas al terminar:
 * `orders` esta en `on delete cascade` desde `order_items` y `seed` es idempotente.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  type AlmacenComensal,
  almacenComensalDeBase,
} from "../../../workers/api/src/comensal/datos.ts"
import type { ClientePostgres, ParametrosConexion } from "../src/conexion.ts"
import { cadenaDeConexion, cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG1 = "11111111-1111-1111-1111-111111111111"
const LOC_A = "aaaaaaaa-0000-0000-0000-000000000001"
const MESA_A1 = "e0000000-0000-0000-0000-000000000001"
const SES_ACTIVA = "f0000000-0000-0000-0000-000000000001"
const CODIGO_A = "ABCDEFGH"
const CAT_PRINCIPALES = "05000000-0000-0000-0000-000000000002"
const ITEM_LOMO = "04000000-0000-0000-0000-000000000003" // va a Frio (no auto)
const ITEM_BEBIDA = "04000000-0000-0000-0000-000000000001" // va a Barra (auto)

type Puesto = {
  readonly id: string
  readonly nombre: string
  readonly autoAcepta: boolean
}

let entorno: EntornoDePruebas | undefined
let admin: ClientePostgres | undefined
let almacen: AlmacenComensal | undefined
const PUESTOS = new Map<string, Puesto>()

function adminCliente(): ClientePostgres {
  if (admin === undefined) {
    throw new Error("El cliente de administracion no esta conectado")
  }
  return admin
}

/**
 * Los puestos reales de los dos platos, resueltos por la base (plato -> categoria -> defecto).
 * Es exactamente lo que la carta del comensal pone en cada linea antes de enviar.
 */
async function resolverPuesto(cliente: ClientePostgres, item: string): Promise<Puesto> {
  const resultado = await cliente.query<{
    id: string
    nombre: string
    auto_accept: boolean
  }>(
    `select ks.id, ks.name as nombre, ks.auto_accept
       from public.kitchen_stations ks
      where ks.id = (
        select public.camarero_estacion_de_plato($1::uuid)
      )`,
    [item],
  )
  const fila = resultado.rows[0]
  if (fila === undefined) {
    throw new Error(`El plato ${item} no resolvio a ningun puesto`)
  }
  return { id: fila.id, nombre: fila.nombre, autoAcepta: fila.auto_accept }
}

/** Lee las comandas que la base guardo para la clave de envio, ordenadas por puesto. */
async function comandasDeClave(
  cliente: ClientePostgres,
  clave: string,
): Promise<readonly { puesto: string; status: string; subtotal: number }[]> {
  const resultado = await cliente.query<{
    prep_station: string
    status: string
    subtotal_clp: number
  }>(
    `select prep_station, status, subtotal_clp
       from public.orders
      where idempotency_key like $1
      order by prep_station`,
    [`${clave}.%`],
  )
  return resultado.rows.map((fila) => ({
    puesto: fila.prep_station,
    status: fila.status,
    subtotal: fila.subtotal_clp,
  }))
}

async function limpiar(cliente: ClientePostgres, clave: string): Promise<void> {
  await cliente.query("delete from public.orders where idempotency_key like $1", [`${clave}.%`])
}

async function sembrar(admin: ParametrosConexion): Promise<void> {
  const cliente = await conectar(admin)
  try {
    await cliente.query(`
      insert into public.orgs (id, name) values ('${ORG1}', 'Organizacion Uno');

      insert into public.locations (id, org_id, slug, name, status) values
        ('${LOC_A}', '${ORG1}', 'local-a', 'Local A', 'active');

      insert into public.tables (id, location_id, label, code) values
        ('${MESA_A1}', '${LOC_A}', 'Mesa A1', '${CODIGO_A}');

      insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
        ('${SES_ACTIVA}', '${ORG1}', '${LOC_A}', '${MESA_A1}', 'MESA-A-ACTIVA', 'active');
    `)
    // La categoria trae su puesto (Caliente); el lomo lo anula y va a Frio. La bebida no tiene
    // puesto propio: cae al defecto del local (Cocina)... salvo que le demos uno de Barra.
    await cliente.query(
      `insert into public.menu_categories (id, location_id, name_i18n, prep_station_id)
       select $1, $2, '{"es":"Principales"}'::jsonb, id
         from public.kitchen_stations where location_id = $2 and name = 'Caliente'`,
      [CAT_PRINCIPALES, LOC_A],
    )
    await cliente.query(
      `insert into public.menu_items
         (id, location_id, category_id, name_i18n, price_clp, prep_station_id)
       values ($1, $2, $3, '{"es":"Lomo"}'::jsonb, 9000,
               (select id from public.kitchen_stations where location_id = $2 and name = 'Frío')),
              ($4, $2, $3, '{"es":"Agua"}'::jsonb, 2000,
               (select id from public.kitchen_stations where location_id = $2 and name = 'Barra'))`,
      [ITEM_LOMO, LOC_A, CAT_PRINCIPALES, ITEM_BEBIDA],
    )
    PUESTOS.set(ITEM_LOMO, await resolverPuesto(cliente, ITEM_LOMO))
    PUESTOS.set(ITEM_BEBIDA, await resolverPuesto(cliente, ITEM_BEBIDA))
  } finally {
    await cerrar(cliente)
  }
}

function puestoDe(item: string): Puesto {
  const puesto = PUESTOS.get(item)
  if (puesto === undefined) {
    throw new Error(`Sin puesto sembrado para ${item}`)
  }
  return puesto
}

/** La cesta de una parrilla y una bebida, ya resuelta contra la carta, como la manda el borde. */
function cesta(): readonly {
  platoId: string
  cantidad: number
  puestoId: string
  puestoNombre: string
  autoAcepta: boolean
}[] {
  const frio = puestoDe(ITEM_LOMO)
  const barra = puestoDe(ITEM_BEBIDA)
  return [
    {
      platoId: ITEM_LOMO,
      cantidad: 2,
      puestoId: frio.id,
      puestoNombre: frio.nombre,
      autoAcepta: frio.autoAcepta,
    },
    {
      platoId: ITEM_BEBIDA,
      cantidad: 1,
      puestoId: barra.id,
      puestoNombre: barra.nombre,
      autoAcepta: barra.autoAcepta,
    },
  ]
}

function almacenDePruebas(): AlmacenComensal {
  if (almacen === undefined) {
    throw new Error("El almacen del comensal no esta listo")
  }
  return almacen
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
  await sembrar(entorno.parametros.admin)
  admin = await conectar(entorno.parametros.admin)
  almacen = almacenComensalDeBase(cadenaDeConexion(entorno.parametros.app))
}, 240_000)

afterAll(async () => {
  await cerrar(admin)
  entorno?.detener()
})

describe("El envio real parte la cesta por destino (H2)", () => {
  it("debe crear DOS comandas para una parrilla y una bebida, cada una con su puesto", async () => {
    const cliente = adminCliente()
    const frio = puestoDe(ITEM_LOMO)
    const barra = puestoDe(ITEM_BEBIDA)
    try {
      const resultado = await almacenDePruebas().enviar(
        CODIGO_A,
        SES_ACTIVA,
        "h2-frio-barra",
        cesta(),
      )
      expect(resultado.tipo).toBe("ok")
      const comandas = await comandasDeClave(cliente, "h2-frio-barra")
      expect(comandas).toHaveLength(2)
      expect(new Set(comandas.map((c) => c.puesto))).toEqual(new Set([frio.nombre, barra.nombre]))
    } finally {
      await limpiar(cliente, "h2-frio-barra")
    }
  })

  it("debe nacer ACEPTADA la comanda de barra, con sus importes cerrados", async () => {
    const cliente = adminCliente()
    const barra = puestoDe(ITEM_BEBIDA)
    const frio = puestoDe(ITEM_LOMO)
    try {
      await almacenDePruebas().enviar(CODIGO_A, SES_ACTIVA, "h2-auto", cesta())
      const comandas = await comandasDeClave(cliente, "h2-auto")
      const deBarra = comandas.find((c) => c.puesto === barra.nombre)
      const deFrio = comandas.find((c) => c.puesto === frio.nombre)
      expect(deBarra?.status).toBe("aceptada")
      // 2000 x 1 = 2000: el disparador de cierre calculo los importes al nacer aceptada.
      expect(deBarra?.subtotal).toBe(2000)
      // La de un puesto que no auto-acepta sigue esperando aprobacion humana.
      expect(deFrio?.status).toBe("pendiente")
    } finally {
      await limpiar(cliente, "h2-auto")
    }
  })

  it("REENVIAR con la misma clave no debe crear cuatro comandas", async () => {
    const cliente = adminCliente()
    try {
      const primera = await almacenDePruebas().enviar(CODIGO_A, SES_ACTIVA, "h2-idem", cesta())
      const segunda = await almacenDePruebas().enviar(CODIGO_A, SES_ACTIVA, "h2-idem", cesta())
      expect(primera.tipo).toBe("ok")
      expect(segunda.tipo).toBe("ok")
      const comandas = await comandasDeClave(cliente, "h2-idem")
      expect(comandas).toHaveLength(2)
    } finally {
      await limpiar(cliente, "h2-idem")
    }
  })
})
