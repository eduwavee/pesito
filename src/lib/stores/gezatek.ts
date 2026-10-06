import * as cheerio from "cheerio";
import { getHtml } from "../http";
import { absUrl, cleanText, parseArs } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://gezatek.com.ar";

/** Gezatek (plataforma qloud.ar) expone id/nombre/precio/marca en data-attributes. */
export function parseGezatek(html: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  $("[data-id][data-precio][data-nombre]").each((_, el) => {
    const card = $(el);
    const id = card.attr("data-id")!;
    const price = parseArs(card.attr("data-precio"));
    const title = cleanText(card.attr("data-nombre"));
    const href = card.find("a[href]").first().attr("href");
    if (!price || !title || !href) return;
    const text = card.text();
    out.push({
      id: `gz-${id}`,
      store: "gezatek",
      title,
      brand: card.attr("data-marca"),
      price,
      url: absUrl(href, BASE)!,
      image: absUrl(card.find("img").first().attr("src"), BASE),
      inStock: /sin stock/i.test(text) ? false : /stock/i.test(text) ? true : undefined,
      badge: "Precio Geza",
    });
  });
  return out;
}

export const gezatek: StoreAdapter = {
  id: "gezatek",
  async search(query, limit) {
    const q = encodeURIComponent(query).replace(/%20/g, "+");
    const html = await getHtml(`${BASE}/buscar/?q=${q}`);
    return parseGezatek(html).slice(0, limit);
  },
};
