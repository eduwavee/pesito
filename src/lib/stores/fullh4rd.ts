import * as cheerio from "cheerio";
import { getHtml } from "../http";
import { absUrl, cleanText, parseArs } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://fullh4rd.com.ar";

/** Exportado para tests con HTML guardado */
export function parseFullh4rd(html: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  $(".item.product-list").each((_, el) => {
    const card = $(el);
    const a = card.find("a[href]").first();
    const href = a.attr("href");
    const title = cleanText(card.find("h3").first().text());
    const priceEl = card.find(".price").first();
    const listPrice = parseArs(priceEl.find(".price-promo").text());
    // el precio vigente es el texto propio del div, sin el <span> tachado
    const price = parseArs(priceEl.clone().children().remove().end().text());
    const id = /\/prod\/(\d+)/.exec(href ?? "")?.[1];
    if (!href || !title || !price) return;
    out.push({
      id: `fh-${id ?? href}`,
      store: "fullh4rd",
      title,
      price,
      listPrice: listPrice && listPrice > price ? listPrice : undefined,
      url: absUrl(href, BASE)!,
      image: absUrl(card.find("img").first().attr("src"), BASE),
      badge: cleanText(card.find(".tags .tag").first().text()) || undefined,
    });
  });
  return out;
}

export const fullh4rd: StoreAdapter = {
  id: "fullh4rd",
  async search(query, limit) {
    const html = await getHtml(`${BASE}/cat/search/${encodeURIComponent(query)}`);
    return parseFullh4rd(html).slice(0, limit);
  },
};
