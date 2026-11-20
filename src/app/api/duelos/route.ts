import { connection } from "next/server";
import { cached } from "@/lib/cache";
import { DUELOS, dueloResult } from "@/lib/duelos";
import { cheapestOf } from "@/lib/prices";

export const maxDuration = 45;

/** GET /api/duelos → los duelos destacados con el más barato de hoy de cada lado. */
export async function GET() {
  // nunca en el build: sin esto Next la ejecuta para prerenderizarla (y consultaría tiendas sin red)
  await connection();
  const { value } = await cached("duelos", 30 * 60_000, async () => {
    // cada modelo una sola vez (RTX 5060 aparece en dos duelos)
    const queries = [...new Set(DUELOS.flatMap((d) => [d.a, d.b]))];
    const prices = new Map(await Promise.all(queries.map(async (q) => [q, await cheapestOf(q)] as const)));
    return DUELOS.map((d) => dueloResult(d, prices.get(d.a), prices.get(d.b)));
  });
  return Response.json({ duelos: value }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
