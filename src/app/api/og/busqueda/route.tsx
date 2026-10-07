import type { NextRequest } from "next/server";
import { formatArs, formatNum } from "@/lib/format";
import { cartelImage } from "@/lib/og/render";
import { bestByStore } from "@/lib/race";
import { searchStore } from "@/lib/stores";
import { STORE_IDS, STORES } from "@/lib/stores/meta";

/** Imagen para compartir una búsqueda: el más barato en el cartel y el mínimo de cada tienda al lado. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) {
    return cartelImage({
      heading: "¿Dónde está más barato?",
      price: "—",
      caption: "Compará hardware en siete tiendas argentinas, en vivo.",
      rows: STORE_IDS.map((s) => ({ label: STORES[s].name, value: "", dot: STORES[s].color })),
      footer: "Comparador de precios",
    });
  }

  const results = await Promise.all(STORE_IDS.map((s) => searchStore(s, q)));
  const best = [...bestByStore(results.flatMap((r) => r.products)).values()].sort((a, b) => a.price - b.price);
  const answered = results.filter((r) => r.status !== "error").length;
  const winner = best[0];

  return cartelImage({
    heading: winner ? `Más barato en ${STORES[winner.store].name}` : `Sin precios para “${q}”`,
    price: winner ? formatNum(winner.price) : "—",
    caption: winner?.title ?? "Probá con menos palabras o con el modelo exacto.",
    rows: best.map((p, i) => ({
      label: STORES[p.store].name,
      value: formatArs(p.price),
      dot: STORES[p.store].color,
      strong: i === 0,
    })),
    footer: `“${q}” · ${answered} tiendas`,
  });
}
