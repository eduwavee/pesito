import * as cheerio from "cheerio";
import { getHtml } from "../http";
import { absUrl, cleanText, parseArs } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://www.venex.com.ar/";

interface EnhancedClick {
  id: string;
  name: string;
  brand?: string;
  price: string;
}

/**
 * Venex mete los datos del producto en un JSON dentro del onclick
 * (enhancedClick({...})) — más estable que leer el DOM del precio.
 */
export function parseVenex(html: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  const seen = new Set<string>();
  $(".product-box").each((_, el) => {
    const card = $(el);
    const a = card.find("a[onclick*='enhancedClick']").first();
    const json = /enhancedClick\((\{[\s\S]*?\})\)/.exec(a.attr("onclick") ?? "")?.[1];
    if (!json) return;
    let data: EnhancedClick;
    try {
      data = JSON.parse(json);
    } catch {
      return;
    }
    const price = parseArs(data.price);
    if (!price || seen.has(data.id)) return;
    seen.add(data.id);
    const href = (a.attr("href") ?? "").split("?")[0];
    out.push({
      id: `vx-${data.id}`,
      store: "venex",
      title: cleanText(data.name),
      brand: data.brand,
      price,
      url: absUrl(href, BASE)!,
      image: absUrl(card.find(".product-box-media img").first().attr("src"), BASE),
      inStock: !/sin stock/i.test(card.text()),
      badge: "Contado",
    });
  });
  return out;
}

export const venex: StoreAdapter = {
  id: "venex",
  async search(query, limit) {
    const q = encodeURIComponent(query).replace(/%20/g, "+");
    const html = await getHtml(`${BASE}resultado-busqueda.htm?keywords=${q}`, {
      charset: "windows-1252",
    });
    return parseVenex(html).slice(0, limit);
  },
};
