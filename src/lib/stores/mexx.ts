import * as cheerio from "cheerio";
import { getHtml } from "../http";
import { absUrl, cleanText, parseArs } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://www.mexx.com.ar";

export function parseMexx(html: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  const seen = new Set<string>();
  $(".card.card-ecommerce").each((_, el) => {
    const card = $(el);
    const a = card.find(".card-title a[href]").first();
    const href = a.attr("href");
    const title = cleanText(a.text());
    const price = parseArs(card.find(".price h4 b").first().text());
    const listPrice = parseArs(card.find(".price .anterior").first().text());
    // "Art: 5162" — el mismo producto aparece repetido en varios rubros
    const art = /Art:\s*(\d+)/.exec(card.find(".card-description").text())?.[1] ?? href;
    if (!href || !title || !price || !art || seen.has(art)) return;
    seen.add(art);
    const img = card.find("img").first().attr("src");
    out.push({
      id: `mx-${art}`,
      store: "mexx",
      title,
      price,
      listPrice: listPrice && listPrice > price ? listPrice : undefined,
      url: absUrl(href, BASE)!,
      image: img && !/no_image/.test(img) ? absUrl(img, BASE) : undefined,
      inStock: /en stock/i.test(card.find(".enstocklistado").text()) || undefined,
      badge: "Precio contado",
    });
  });
  return out;
}

export const mexx: StoreAdapter = {
  id: "mexx",
  async search(query, limit) {
    const q = encodeURIComponent(query).replace(/%20/g, "+");
    const html = await getHtml(`${BASE}/buscar/?p=${q}`);
    return parseMexx(html).slice(0, limit);
  },
};
