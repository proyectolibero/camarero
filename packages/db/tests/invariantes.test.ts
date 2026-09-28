/**
 * Invariantes de seguridad del esquema.
 *
 * Estos tests no comprueban comportamiento: comprueban PROPIEDADES que, si se pierden,
 * convierten el aislamiento en un agujero sin que nada mas falle. Son el tipo de test que
 * este proyecto necesita porque ya se ha roto tres veces por no existir.
 *
 * Se conectan como `camarero_app` (nunca como el propietario: LL-004).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ParametrosConexion } from "../src/conexion.ts"
import { consultar } from "../src/conexion.ts"
import type { EntornoDePruebas } from "../src/entorno.ts"
import { levantarEntornoDePruebas } from "../src/entorno.ts"

let entorno: EntornoDePruebas | undefined

function parametrosApp(): ParametrosConexion {
  if (entorno === undefined) {
    throw new Error("El entorno de pruebas no esta levantado")
  }
  return entorno.parametros.app
}

beforeAll(async () => {
  entorno = await levantarEntornoDePruebas()
}, 180_000)

afterAll(() => {
  entorno?.detener()
})

/**
 * Funciones `SECURITY DEFINER` que no estan endurecidas.
 *
 * Dos condiciones, y las dos importan por motivos distintos:
 *
 *  1. `search_path` que incluya `public`. PostgreSQL resuelve los nombres de relacion en
 *     `pg_temp` ANTES que en el search_path: una funcion definer con `public` en la ruta
 *     puede ser secuestrada con una tabla temporal homonima. Ataque confirmado en este
 *     proyecto (RISK-017).
 *  2. Referencias `FROM`/`JOIN` sin cualificar. Aunque el search_path sea limpio, una
 *     referencia sin `public.` delante es resoluble por el llamante si consigue colocar un
 *     objeto con ese nombre en un esquema que si este en la ruta.
 *  3. Llamadas a funciones PROPIAS sin cualificar. Con `search_path = pg_catalog`, un
 *     nombre sin `public.` no resuelve en tiempo de ejecucion: la funcion revienta con
 *     "function ... does not exist". Ocurrio de verdad en la migracion 0012 y el control
 *     no lo vio, porque solo miraba las relaciones. Una funcion definer endurecida tiene
 *     que apellidar TODO, tambien sus propias funciones.
 *
 *     Esta comprobacion se hace contra el CATALOGO, no con una lista de excepciones: para
 *     cada funcion definer endurecida se buscan, en su cuerpo, los nombres que coinciden
 *     con funciones reales de `public` y que no van precedidos de `public.`. Asi el test
 *     no envejece cuando se anade una funcion nueva.
 */
const FUNCIONES_NO_ENDURECIDAS = `
  with definers as (
    select p.oid, p.proname as funcion, p.prosrc as cuerpo,
           coalesce(array_to_string(p.proconfig, ', '), '(sin configurar)') as configuracion
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prosecdef = true
  ),
  propias as (
    select proname::text as nombre
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  ),
  -- Para cada funcion definer y cada funcion propia, se cuentan las llamadas totales al
  -- nombre y cuantas van con el prefijo de esquema delante. Si hay mas llamadas que
  -- llamadas cualificadas, al menos una va sin apellidar. Es aritmetica, no una lista de
  -- excepciones: no envejece al anadir funciones.
  sin_cualificar as (
    select d.funcion, pr.nombre
      from definers d
      cross join propias pr
     where (
       select count(*) from regexp_matches(d.cuerpo, '(?i)\\m' || pr.nombre || '\\s*\\(', 'g')
     ) > (
       select count(*) from regexp_matches(d.cuerpo, '(?i)\\mpublic\\.' || pr.nombre || '\\s*\\(', 'g')
     )
  ),
  con_problema as (
    select d.funcion, d.configuracion,
           case
             when d.configuracion like '%public%' then 'search_path incluye public'
             when d.cuerpo ~* '(from|join)\\s+(?!only\\s+)(?!public\\.)(?!pg_catalog\\.)[a-z_][a-z0-9_]*\\s'
               then 'referencia sin cualificar en el cuerpo'
             else 'llamada a funcion propia sin cualificar'
           end as motivo
      from definers d
     where d.configuracion like '%public%'
        or d.cuerpo ~* '(from|join)\\s+(?!only\\s+)(?!public\\.)(?!pg_catalog\\.)[a-z_][a-z0-9_]*\\s'
        or exists (select 1 from sin_cualificar sc where sc.funcion = d.funcion)
  )
  select funcion, configuracion, motivo from con_problema order by funcion
`

/**
 * Tablas en las que una politica lee su propia tabla, directa o transitivamente.
 *
 * Esta es la comprobacion de ADR-0012: la regla es "cero ciclos", y sin este test la regla
 * es una convencion que se rompe sin que nadie se entere. El grafo se construye con dos
 * fuentes, porque ninguna basta sola:
 *
 *  - `pg_depend` registra las funciones y tablas referenciadas directamente en la
 *    expresion de una politica, pero NO el interior de los cuerpos de funcion.
 *  - `pg_proc.prosrc` contiene el SQL de las funciones, que aqui son `LANGUAGE sql` y
 *    tienen las referencias cualificadas.
 */
const CICLOS_DE_POLITICAS = `
  create temp table t_tablas on commit drop as
    select c.relname::text as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p');

  create temp table t_funcs on commit drop as
    select p.oid, p.proname::text as func, p.prosrc as cuerpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f';

  create temp table t_politicas on commit drop as
    select c.relname::text as tabla,
           coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') as texto
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public';

  -- politica -> otra tabla, via pg_depend
  create temp table t_pol_lee_tabla on commit drop as
    select distinct c.relname::text as desde, c2.relname::text as hasta
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_depend d on d.classid = 'pg_policy'::regclass
                      and d.objid = pol.oid
                      and d.refclassid = 'pg_class'::regclass
                      and d.deptype = 'n'
      join pg_class c2 on c2.oid = d.refobjid
     where c2.relkind in ('r', 'p') and c2.oid <> pol.polrelid;

  -- politica -> su PROPIA tabla, leida explicitamente en el texto de la politica
  insert into t_pol_lee_tabla (desde, hasta)
    select distinct pol.tabla, pol.tabla
      from t_politicas pol
     where pol.texto ~* ('(from|join)\\s+(only\\s+)?(public\\.)?' || pol.tabla || '\\M');

  -- politica -> funcion, via pg_depend
  create temp table t_pol_llama_func on commit drop as
    select distinct c.relname::text as desde, pf.proname::text as func
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_depend d on d.classid = 'pg_policy'::regclass
                      and d.objid = pol.oid
                      and d.refclassid = 'pg_proc'::regclass
                      and d.deptype = 'n'
      join pg_proc pf on pf.oid = d.refobjid
      join pg_namespace n on n.oid = pf.pronamespace
     where n.nspname = 'public';

  -- funcion -> funcion y funcion -> tabla, leyendo el cuerpo
  create temp table t_func_llama_func on commit drop as
    select distinct f.func as desde, m[1] as hasta
      from t_funcs f,
           lateral regexp_matches(f.cuerpo, '([a-z_][a-z0-9_]*)\\s*\\(', 'g') as m
     where m[1] in (select func from t_funcs);

  create temp table t_func_lee_tabla on commit drop as
    select distinct f.func as desde, m[1] as hasta
      from t_funcs f,
           lateral regexp_matches(
             f.cuerpo,
             '(?i)\\y(?:from|join)\\y\\s+(?:only\\s+)?(?:public\\.)?([a-z_][a-z0-9_]*)',
             'g'
           ) as m
     where m[1] in (select tabla from t_tablas);

  create temp table t_func_alcanza on commit drop as
    with recursive alcanza(func, tabla) as (
      select desde, hasta from t_func_lee_tabla
      union
      select fl.desde, al.tabla
        from t_func_llama_func fl join alcanza al on al.func = fl.hasta
    )
    select distinct func, tabla from alcanza;

  create temp table t_aristas on commit drop as
    select desde, hasta from t_pol_lee_tabla
    union
    select pf.desde, fa.tabla
      from t_pol_llama_func pf join t_func_alcanza fa on fa.func = pf.func;

  -- cierre transitivo: una tabla que se alcanza a si misma esta en un ciclo
  with recursive tc(a, b) as (
    select desde, hasta from t_aristas
    union
    select tc.a, e.hasta from tc join t_aristas e on e.desde = tc.b
  )
  select distinct a as tabla_en_ciclo from tc where a = b order by 1
`

describe("Invariantes de seguridad del esquema", () => {
  it("toda funcion SECURITY DEFINER debe tener search_path sin public y referencias cualificadas", async () => {
    const filas = await consultar<{ funcion: string; configuracion: string; motivo: string }>(
      parametrosApp(),
      FUNCIONES_NO_ENDURECIDAS,
    )

    // Si falla, el mensaje tiene que decir EXACTAMENTE que funcion y por que: una funcion
    // definer sin endurecer es un vector de escalada, no un detalle de estilo.
    const detalle = filas.map((f) => `  - ${f.funcion} (${f.motivo}; config: ${f.configuracion})`)
    expect(filas.length, `Funciones SECURITY DEFINER sin endurecer:\n${detalle.join("\n")}`).toBe(0)
  })

  it("ninguna politica puede leer su propia tabla, ni directa ni transitivamente", async () => {
    const filas = await consultar<{ tabla_en_ciclo: string }>(parametrosApp(), CICLOS_DE_POLITICAS)

    const detalle = filas.map((f) => `  - ${f.tabla_en_ciclo}`)
    expect(
      filas.length,
      "Tablas con ciclo de politicas (se leen a si mismas, ADR-0012):\n" +
        `${detalle.join("\n")}\n` +
        "Un ciclo hace que PostgreSQL aborte con 'infinite recursion detected in policy'.",
    ).toBe(0)
  })
})
