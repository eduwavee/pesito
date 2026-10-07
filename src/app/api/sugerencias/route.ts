import type { NextRequest } from "next/server";
import { cached } from "@/lib/cache";
import { getDb } from "@/lib/db";
import { catalogTitles } from "@/lib/stores/compragamer";
import { buildVocabulary, completions, CURATED, didYouMean } from "@/lib/suggest";

/** Vocabulario = catálogo de Compra Gamer (miles de productos) + sugerencias fijas. */
async function vocabulary() {
  const { value } = await cached("vocab", 15 * 60_000, async () => {
    const titles = process.env.DEMO_MODE === "1" ? [] : await catalogTitles().catch(() => []);
    return buildVocabulary([...titles, ...CURATED]);
  });
  return value;
}

async function popular() {
  return getDb()
    .topQueries(200)
    .catch(() => []);
}

/**
 * GET /api/sugerencias?q=rtx 50            → { completions: ["RTX 5060", ...] }
 * GET /api/sugerencias?q=rxt 5060&corregir=1 → { completions, didYouMean: "rtx 5060" }
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ completions: [] });
  const fix = req.nextUrl.searchParams.get("corregir") === "1";
  const [top, vocab] = await Promise.all([popular(), fix ? vocabulary() : undefined]);
  return Response.json(
    { completions: completions(q, top), didYouMean: vocab ? didYouMean(q, vocab) : undefined },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
