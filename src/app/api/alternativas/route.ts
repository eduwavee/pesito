import type { NextRequest } from "next/server";
import { candidatesFor, pickAlternatives } from "@/lib/alternatives";
import { cached } from "@/lib/cache";
import { findPerf } from "@/lib/perf";
import { cheapestOf } from "@/lib/prices";

export const maxDuration = 30;

/**
 * GET /api/alternativas?q=rtx 5060 → { model, price, alternatives: [...] }
 * Solo para placas y procesadores que están en la tabla de rendimiento; si no, lista vacía.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const model = findPerf(q);
  if (!model) return Response.json({ alternatives: [] }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  // por modelo, no por texto: "rtx 5060" y "RTX 5060 8GB" comparten resultado
  const { value } = await cached(`alt:${model.query}`, 30 * 60_000, async () => {
    const cands = candidatesFor(model);
    const [base, ...prices] = await Promise.all([cheapestOf(model.query), ...cands.map((c) => cheapestOf(c.query))]);
    if (!base) return { model: model.query, alternatives: [] };
    return {
      model: model.query,
      price: base.price,
      alternatives: pickAlternatives(
        { model, price: base.price },
        cands.map((m, i) => ({ model: m, product: prices[i] })),
      ),
    };
  });
  return Response.json(value, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
