/**
 * La migracion 0021 sobre datos que ya existian (TASK-F1-09).
 *
 * Se levanta el esquema HASTA 0020, se siembra una carta y unas comandas con el modelo viejo
 * (la estacion como texto fijo), se cuentan las filas y DESPUES se aplica 0021. Se comprueba
 * que no se pierde ni se duplica nada y que cada fila se enlaza con su puesto.
 *
 * Es la unica prueba que no levanta el esquema completo: por eso `levantarEntornoDePruebas`
 * acepta un directorio de migraciones.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { aplicarMigraciones } from "../scripts/aplicar-migraciones.ts"
import type { ClientePostgres } from "../src/conexion.ts"
import { cerrar, conectar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

const ORG = "33333333-3333-3333-3333-333333333333"
const LOC = "cccccccc-0000-0000-0000-000000000001"
const CAT = "06000000-0000-0000-0000-000000000001"
const ITEM_FRIO = "07000000-0000-0000-0000-000000000001"
const ITEM_BEBIDAS = "07000000-0000-0000-0000-000000000002"
const ITEM_SIN = "07000000-0000-0000-0000-000000000003"
const SES = "08000000-0000-0000-0000-000000000001"
const MESA = "09000000-0000-0000-0000-000000000001"

const DIRECTORIO_MIGRACIONES = fileURLToPath(new URL("../migrations/", import.meta.url))
const DIRECTORIO_VIEJO = "viejo"
const DIRECTORIO_NUEVO = "nuevo"
const CORTE = "0021"

let entorno: EntornoDePruebas | undefined
let baseTemporal = ""
let admin: ClientePostgres | undefined

function prepararDirectorios(): { viejo: string; nuevo: string } {
  baseTemporal = mkdtempSync(join(tmpdir(), "camarero-migracion-"))
  const viejo = join(baseTemporal, DIRECTORIO_VIEJO)
  const nuevo = join(baseTemporal, DIRECTORIO_NUEVO)
  mkdirSync(viejo)
  mkdirSync(nuevo)
  for (const fichero of readdirSync(DIRECTORIO_MIGRACIONES)) {
    if (!fichero.endsWith(".sql")) {
      continue
    }
    const destino = fichero < CORTE ? viejo : nuevo
    copyFileSync(join(DIRECTORIO_MIGRACIONES, fichero), join(destino, fichero))
  }
  return { viejo, nuevo }
}

async function contar(cliente: ClientePostgres, tabla: string): Promise<number> {
  const resultado = await cliente.query<{ n: number }>(
    `select count(*)::int as n from public.${tabla}`,
  )
  return resultado.rows[0]?.n ?? -1
}

async function sembrarLegacy(cliente: ClientePostgres): Promise<void> {
  await cliente.query(`
    insert into public.orgs (id, name) values ('${ORG}', 'Organizacion Legacy');
    insert into public.locations (id, org_id, slug, name, status) values
      ('${LOC}', '${ORG}', 'local-legacy', 'Local Legacy', 'active');
    insert into public.tables (id, location_id, label, code) values
      ('${MESA}', '${LOC}', 'Mesa 1', 'ABCDEFGH');
    insert into public.table_sessions (id, org_id, location_id, table_id, code, state) values
      ('${SES}', '${ORG}', '${LOC}', '${MESA}', 'MESA-LEGACY', 'active');
    insert into public.menu_categories (id, location_id, name_i18n) values
      ('${CAT}', '${LOC}', '{"es":"Entrantes"}');
    insert into public.menu_items (id, location_id, category_id, name_i18n, price_clp, prep_station) values
      ('${ITEM_FRIO}', '${LOC}', '${CAT}', '{"es":"Ceviche"}', 8000, 'frio'),
      ('${ITEM_BEBIDAS}', '${LOC}', '${CAT}', '{"es":"Agua"}', 2000, 'bebidas'),
      ('${ITEM_SIN}', '${LOC}', '${CAT}', '{"es":"Pan"}', 1000, null);
    insert into public.orders
      (id, org_id, location_id, session_id, source, prep_station, idempotency_key) values
      ('0a000000-0000-0000-0000-000000000001', '${ORG}', '${LOC}', '${SES}', 'table', 'bar', 'legacy-bar'),
      ('0a000000-0000-0000-0000-000000000002', '${ORG}', '${LOC}', '${SES}', 'table', 'cocina', 'legacy-cocina');
  `)
}

beforeAll(async () => {
  const { viejo, nuevo } = prepararDirectorios()
  entorno = await levantarEntornoDePruebas({ directorioMigraciones: viejo })
  admin = await conectar(entorno.parametros.admin)
  // Se siembra con el modelo viejo y se comprueba el corte: antes de 0021 no existe la columna.
  await sembrarLegacy(admin)
  const columna = await admin.query<{ existe: boolean }>(
    "select exists (select 1 from information_schema.columns where table_name = 'menu_items' and column_name = 'prep_station_id') as existe",
  )
  expect(columna.rows[0]?.existe).toBe(false)
  // Se aplica SOLO la 0021 sobre la base que ya tenia datos.
  await aplicarMigraciones(entorno.parametros.owner, nuevo)
}, 300_000)

afterAll(async () => {
  await cerrar(admin)
  entorno?.detener()
  if (baseTemporal !== "") {
    rmSync(baseTemporal, { recursive: true, force: true })
  }
})

describe("Migracion 0021 sobre datos existentes", () => {
  it("no debe perder ni duplicar ninguna fila", async () => {
    if (admin === undefined) {
      throw new Error("Sin conexion")
    }
    // El seed tenia: 1 local, 1 categoria, 3 platos, 2 comandas. Despues siguen siendo los mismos.
    expect(await contar(admin, "locations")).toBe(1)
    expect(await contar(admin, "menu_categories")).toBe(1)
    expect(await contar(admin, "menu_items")).toBe(3)
    expect(await contar(admin, "orders")).toBe(2)
  })

  it("debe crear el juego de puestos del local sin duplicarlos", async () => {
    if (admin === undefined) {
      throw new Error("Sin conexion")
    }
    const puestos = await admin.query<{ n: number }>(
      "select count(*)::int as n from public.kitchen_stations where location_id = $1",
      [LOC],
    )
    expect(puestos.rows[0]?.n).toBe(6)
    const unicos = await admin.query<{ n: number }>(
      "select count(distinct name)::int as n from public.kitchen_stations where location_id = $1",
      [LOC],
    )
    expect(unicos.rows[0]?.n).toBe(6)
  })

  it("debe enlazar cada plato con el puesto de su estacion vieja", async () => {
    if (admin === undefined) {
      throw new Error("Sin conexion")
    }
    const resultado = await admin.query<{ item: string; name: string | null }>(
      `select mi.id as item, ks.name
         from public.menu_items mi
         left join public.kitchen_stations ks on ks.id = mi.prep_station_id
        where mi.id = any($1::uuid[]) order by mi.id`,
      [[ITEM_FRIO, ITEM_BEBIDAS, ITEM_SIN]],
    )
    const porItem = new Map(resultado.rows.map((fila) => [fila.item, fila.name]))
    expect(porItem.get(ITEM_FRIO)).toBe("Frío")
    expect(porItem.get(ITEM_BEBIDAS)).toBe("Bebidas")
    // El plato sin estacion se queda sin puesto: heredara el de la categoria (null) y el
    // puesto por defecto del local lo resuelve al vuelo.
    expect(porItem.get(ITEM_SIN)).toBeNull()
  })

  it("debe enlazar cada comanda con el puesto de su destino viejo y conservar el nombre", async () => {
    if (admin === undefined) {
      throw new Error("Sin conexion")
    }
    const resultado = await admin.query<{ id: string; prep_station: string; name: string | null }>(
      `select o.id, o.prep_station, ks.name
         from public.orders o
         left join public.kitchen_stations ks on ks.id = o.prep_station_id
        where o.idempotency_key = any($1::text[]) order by o.idempotency_key`,
      [["legacy-bar", "legacy-cocina"]],
    )
    const porDestino = new Map(resultado.rows.map((fila) => [fila.prep_station, fila.name]))
    // La historia no se reescribe: `prep_station` conserva el codigo viejo que se veia, y el
    // identificador nuevo apunta al puesto cuyo nombre es el de la lista fija.
    expect(porDestino.get("bar")).toBe("Barra")
    expect(porDestino.get("cocina")).toBe("Cocina")
  })

  it("debe sembrar los puestos de un local nuevo desde el disparador", async () => {
    if (admin === undefined) {
      throw new Error("Sin conexion")
    }
    const nuevoLocal = "cccccccc-0000-0000-0000-000000000002"
    await admin.query(
      "insert into public.locations (id, org_id, slug, name, status) values ($1, $2, 'local-nuevo', 'Local Nuevo', 'active')",
      [nuevoLocal, ORG],
    )
    const puestos = await admin.query<{ n: number }>(
      "select count(*)::int as n from public.kitchen_stations where location_id = $1",
      [nuevoLocal],
    )
    expect(puestos.rows[0]?.n).toBe(6)
  })
})
