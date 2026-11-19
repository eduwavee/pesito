import * as cheerio from "cheerio";
import { getHtml } from "../http";
import { absUrl, cleanText, parseArs } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://spacegamer.com.ar";

/**
 * Space Gamer: el listado de `/Buscar/{texto}` trae cada tarjeta con `data-id` y `data-nombre`;
 * el precio vigente está en `.itembig-current-price` (o `.product-card__new-price` si hay
 * descuento, con el anterior en `.product-card__old-price`) y el stock en un `aria-label`.
 */
export function parseSpacegamer(html: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  $(".product-card[data-id][data-nombre]").each((_, el) => {
    const card = $(el);
    const id = card.attr("data-id")!;
    const title = cleanText(card.attr("data-nombre"));
    const price = parseArs(card.find(".itembig-current-price, .product-card__new-price").first().text());
    const old = parseArs(card.find(".product-card__old-price").first().text());
    const href = card.find(".product-card__name a[href], a.product-image__body[href]").first().attr("href");
    if (!title || !price || !href) return;
    const stock = card.find("[aria-label^='Disponibilidad']").first().attr("aria-label") ?? "";
    const img = card.find("img.product-image__img").first();
    out.push({
      id: `sg-${id}`,
      store: "spacegamer",
      title,
      price,
      listPrice: old && old > price ? old : undefined,
      url: absUrl(href, BASE)!,
      image: absUrl(img.attr("src") ?? img.attr("data-original"), BASE),
      inStock: !stock ? undefined : !/sin stock|agotad|no disponible/i.test(stock),
    });
  });
  return out;
}

export const spacegamer: StoreAdapter = {
  id: "spacegamer",
  async search(query, limit) {
    const html = await getHtml(`${BASE}/Buscar/${encodeURIComponent(query)}`);
    return parseSpacegamer(html).slice(0, limit);
  },
};
