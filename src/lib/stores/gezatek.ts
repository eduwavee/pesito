import { getHtml } from "../http";
import type { Product, StoreAdapter } from "../types";
import { parseQloud, qloudSearchUrl, type QloudStore } from "./qloud";

const CFG: QloudStore = { store: "gezatek", base: "https://gezatek.com.ar", prefix: "gz", badge: "Precio Geza" };

export function parseGezatek(html: string): Product[] {
  return parseQloud(html, CFG);
}

export const gezatek: StoreAdapter = {
  id: "gezatek",
  async search(query, limit) {
    const html = await getHtml(qloudSearchUrl(CFG.base, query));
    return parseGezatek(html).slice(0, limit);
  },
};
