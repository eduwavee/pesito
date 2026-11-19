import * as cheerio from "cheerio";
import { getJson } from "../http";
import { cleanText } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://goldentechstore.com.ar";

/** Lo que usamos de la Store API pública de WooCommerce (`/wp-json/wc/store/v1/products`). */
export interface WcProduct {
  id: number;
  name: string;
  permalink: string;
  is_in_stock?: boolean;
  on_sale?: boolean;
  prices: { price: string; regular_price?: string; currency_minor_unit?: number };
  images?: { src?: string; thumbnail?: string }[];
}

/** WooCommerce manda los nombres con entidades HTML ("Placa &#8211; 8GB"). */
const decode = (s: string) => cleanText(cheerio.load(`<p>${s}</p>`)("p").text());

/**
 * Goldentech es WooCommerce: la Store API (la misma que usan los bloques de la tienda)
 * devuelve JSON con precio en centavos, stock e imagen, sin tener que leer el HTML.
 */
export function parseGoldentech(items: WcProduct[]): Product[] {
  const out: Product[] = [];
  for (const it of items) {
    const unit = 10 ** (it.prices?.currency_minor_unit ?? 2);
    const price = Math.round(Number(it.prices?.price) / unit);
    const regular = Math.round(Number(it.prices?.regular_price) / unit);
    const title = decode(it.name ?? "");
    if (!it.id || !title || !Number.isFinite(price) || price <= 0 || !it.permalink) continue;
    const img = it.images?.[0];
    out.push({
      id: `gt-${it.id}`,
      store: "goldentech",
      title,
      price,
      listPrice: Number.isFinite(regular) && regular > price ? regular : undefined,
      url: it.permalink,
      image: img?.thumbnail || img?.src || undefined,
      inStock: it.is_in_stock,
    });
  }
  return out;
}

export const goldentech: StoreAdapter = {
  id: "goldentech",
  async search(query, limit) {
    const url = `${BASE}/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}&per_page=${Math.min(limit, 50)}`;
    return parseGoldentech(await getJson<WcProduct[]>(url)).slice(0, limit);
  },
};
