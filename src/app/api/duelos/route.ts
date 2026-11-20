import { connection } from "next/server";
import { cached } from "@/lib/cache";
import { DUELOS, dueloResult } from "@/lib/duelos";
import { limiter } from "@/lib/builder/budget";
import { cheapestOf } from "@/lib/prices";

export const maxDuration = 45;

/** GET /api/duelos → los duelos destacados con el más barato de hoy de cada lado. */
export async function GET() {
  // nunca en el build: sin esto Next la ejecuta para prerenderizarla (y consultaría tiendas sin red)
  await connection();
  // la clave incluye la lista: si cambian los duelos, no sirve lo guardado
  const key = `duelos:${DUELOS.map((d) => `${d.a}/${d.b}`).join("|")}`;
  const { value } = await cached(key, 30 * 60_000, async () => {
    // cada modelo una sola vez (RTX 5060 aparece en dos duelos)
    const queries = [...new Set(DUELOS.flatMap((d) => [d.a, d.b]))];
    // de a 4 búsquedas (cada una consulta todas las tiendas): no le caemos a una tienda con 14 pedidos juntos
    const limit = limiter(4);
    const prices = new Map(await Promise.all(queries.map((q) => limit(async () => [q, await cheapestOf(q)] as const))));
    // un duelo sin precio de un lado no ayuda a decidir: se muestra cuando vuelva a haber stock
    return DUELOS.map((d) => dueloResult(d, prices.get(d.a), prices.get(d.b))).filter((d) => d.pa && d.pb);
  });
  return Response.json({ duelos: value }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
