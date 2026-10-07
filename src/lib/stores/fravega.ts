import { getHtml } from "../http";
import { cleanText } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://www.fravega.com";
const IMG = "https://images.fravega.com/f300/";

interface FvItem {
  code?: string;
  item?: { title?: string; slug?: string; images?: string[] };
  images?: string[];
  marketplace?: boolean;
  seller?: { commercialName?: string };
  pricing?: { salePrice?: number; listPrice?: number };
}

/**
 * Frávega es una app de Next.js: el listado viene entero en el JSON de
 * `__NEXT_DATA__` (estado de Apollo), así que no hace falta leer el DOM.
 */
export function parseFravega(html: string): Product[] {
  const json = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!json) return [];
  let state: Record<string, Record<string, unknown>>;
  try {
    state = JSON.parse(json).props.pageProps.__APOLLO_STATE__;
  } catch {
    return [];
  }
  const root = state.ROOT_QUERY ?? {};
  const key = Object.keys(root).find((k) => k.startsWith("items("));
  const results = ((root[key ?? ""] as { results?: unknown[] } | undefined)?.results ?? []) as (FvItem & { __ref?: string })[];
  const out: Product[] = [];
  for (const raw of results) {
    const it = (raw.__ref ? state[raw.__ref] : raw) as FvItem;
    const title = cleanText(it.item?.title);
    const price = it.pricing?.salePrice;
    if (!it.code || !title || !price || !it.item?.slug) continue;
    const list = it.pricing?.listPrice ? Math.round(it.pricing.listPrice) : undefined;
    const img = it.images?.[0] ?? it.item.images?.[0];
    out.push({
      id: `fv-${it.code}`,
      store: "fravega",
      title,
      price: Math.round(price),
      // vienen con decimales: comparamos ya redondeados
      listPrice: list && list > Math.round(price) ? list : undefined,
      url: `${BASE}/p/${it.item.slug}-${it.code}/`,
      image: img ? `${IMG}${img}` : undefined,
      badge: it.marketplace && it.seller?.commercialName ? `Vende ${it.seller.commercialName}` : undefined,
    });
  }
  return out;
}

export const fravega: StoreAdapter = {
  id: "fravega",
  async search(query, limit) {
    const html = await getHtml(`${BASE}/l/?keyword=${encodeURIComponent(query)}`);
    return parseFravega(html).slice(0, limit);
  },
};
