import type { NextRequest } from "next/server";
import { decodeBuild } from "@/lib/builder/build";
import { PARTS } from "@/lib/builder/parts";
import { formatArs, formatNum } from "@/lib/format";
import { cartelImage } from "@/lib/og/render";
import { searchStore } from "@/lib/stores";
import { STORE_IDS, STORES } from "@/lib/stores/meta";
import type { Product } from "@/lib/types";

/** Imagen para compartir un armado: el total en el cartel y las piezas al lado. */
export async function GET(req: NextRequest) {
  const decoded = decodeBuild(req.nextUrl.search.slice(1));
  // las búsquedas ya están en la cache del server si alguien acaba de armarla
  const picks = await Promise.all(
    PARTS.map(async (def) => {
      const d = decoded[def.id];
      if (!d || d.skipped || !d.pickId || !d.query) return { def, pick: d?.skipped ? null : undefined, qty: 1 };
      const lists = await Promise.all(STORE_IDS.map((s) => searchStore(s, d.query)));
      const pick: Product | undefined = lists.flatMap((r) => r.products).find((p) => p.id === d.pickId);
      return { def, pick, qty: Math.min(def.multi ?? 1, Math.max(1, d.qty ?? 1)) };
    }),
  );
  const chosen = picks.filter((p) => p.pick);
  const total = chosen.reduce((sum, p) => sum + (p.pick?.price ?? 0) * p.qty, 0);

  return cartelImage({
    heading: chosen.length ? "Total del armado" : "Armá tu PC",
    price: chosen.length ? formatNum(total) : "—",
    caption: chosen.length
      ? `${chosen.length} de ${PARTS.length} piezas al mejor precio de siete tiendas`
      : "Pieza por pieza al mejor precio, con chequeo de compatibilidad.",
    rows: picks.map(({ def, pick, qty }) => ({
      label: qty > 1 ? `${def.name} ×${qty}` : def.name,
      value: pick ? formatArs(pick.price * qty) : pick === null ? "Sin placa" : "—",
      dot: pick ? STORES[pick.store].color : undefined,
      strong: !!pick,
    })),
    footer: "Armá tu PC",
  });
}
