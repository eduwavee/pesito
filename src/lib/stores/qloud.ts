import * as cheerio from "cheerio";
import { absUrl, cleanText, parseArs } from "../text";
import type { Product, StoreId } from "../types";

export interface QloudStore {
  store: StoreId;
  base: string;
  /** prefijo de los ids, ej "gz" → "gz-8809" */
  prefix: string;
  /** etiqueta del precio principal (el de `data-precio`), ej "Precio especial" */
  badge: string;
}

/**
 * Tiendas armadas sobre la plataforma qloud.ar (Gezatek, RocketHard): el listado de
 * `/buscar/?q=` trae id/nombre/precio/marca en data-attributes de cada tarjeta.
 * `data-precio` es el precio de contado/transferencia; `.precio_mp`, cuando está,
 * es el precio pagando con Mercado Pago (tarjeta).
 */
export function parseQloud(html: string, cfg: QloudStore): Product[] {
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
    const cardPrice = parseArs(card.find(".precio_mp").first().text());
    out.push({
      id: `${cfg.prefix}-${id}`,
      store: cfg.store,
      title,
      brand: card.attr("data-marca") || undefined,
      price,
      cardPrice: cardPrice && cardPrice > price ? cardPrice : undefined,
      url: absUrl(href, cfg.base)!,
      image: absUrl(card.find("img").first().attr("src"), cfg.base),
      inStock: /sin stock/i.test(text) ? false : /stock/i.test(text) ? true : undefined,
      badge: cfg.badge,
    });
  });
  return out;
}

export function qloudSearchUrl(base: string, query: string) {
  return `${base}/buscar/?q=${encodeURIComponent(query).replace(/%20/g, "+")}`;
}
