import { getHtml } from "../http";
import type { Product, StoreAdapter } from "../types";
import { parseQloud, qloudSearchUrl, type QloudStore } from "./qloud";

/** RocketHard usa la misma plataforma que Gezatek (qloud.ar). */
const CFG: QloudStore = { store: "rockethard", base: "https://rockethard.com.ar", prefix: "rh", badge: "Precio especial" };

export function parseRockethard(html: string): Product[] {
  return parseQloud(html, CFG);
}

export const rockethard: StoreAdapter = {
  id: "rockethard",
  async search(query, limit) {
    const html = await getHtml(qloudSearchUrl(CFG.base, query));
    return parseRockethard(html).slice(0, limit);
  },
};
