import { cached } from "../cache";
import { HttpError } from "../http";
import { arDay, getDb } from "../db";
import { isSecondary, isUsed, matchesQuery, normalize, storeQuery } from "../text";
import type { StoreAdapter, StoreId, StoreResult } from "../types";
import { compragamer } from "./compragamer";
import { demoResults } from "./demo";
import { fravega } from "./fravega";
import { rockethard } from "./rockethard";
import { gezatek } from "./gezatek";
import { mercadolibre } from "./mercadolibre";
import { mexx } from "./mexx";
import { venex } from "./venex";

export const ADAPTERS: Record<StoreId, StoreAdapter> = {
  mercadolibre,
  compragamer,
  rockethard,
  venex,
  mexx,
  gezatek,
  fravega,
};

const TTL = 10 * 60_000;
const LIMIT = 24;
/** Si una tienda nos bloquea, no la volvemos a molestar por un rato: respondemos el error al instante. */
const BLOCKED_TTL = 5 * 60_000;
const blocked = new Map<StoreId, { until: number; message: string }>();

export async function searchStore(store: StoreId, rawQuery: string): Promise<StoreResult> {
  const query = rawQuery.trim().slice(0, 80);
  const t0 = Date.now();
  if (process.env.DEMO_MODE === "1") {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 1200));
    return { store, status: "ok", products: demoResults(store, query), ms: Date.now() - t0, demo: true };
  }
  const block = blocked.get(store);
  if (block && block.until > t0) {
    return { store, status: "error", products: [], ms: 0, message: block.message, blocked: true };
  }
  try {
    const sq = storeQuery(query);
    const { value, hit } = await cached(`q:${store}:${sq}`, TTL, () => ADAPTERS[store].search(sq, LIMIT * 2));
    // los buscadores de las tiendas son "generosos": filtramos lo que no tiene todas las palabras
    const matches = value.filter((p) => matchesQuery(p.title, query));
    // fundas, notebooks que "traen" lo buscado, etc. solo si no hay nada mejor
    const main = matches.filter((p) => !isSecondary(p.title, query));
    const products = (main.length ? main : matches)
      .map((p) => (isUsed(p.title) ? { ...p, used: true } : p))
      .sort((a, b) => a.price - b.price)
      .slice(0, LIMIT);
    // el historial (y las bajas y alertas que salen de él) solo cuenta productos nuevos
    const cheapestNew = products.find((p) => !p.used);
    if (cheapestNew) remember(store, query, cheapestNew);
    return {
      store,
      status: products.length ? "ok" : "empty",
      products,
      ms: Date.now() - t0,
      cached: hit,
    };
  } catch (e) {
    const { message, blocked: isBlock } = describeError(e);
    if (isBlock) blocked.set(store, { until: Date.now() + BLOCKED_TTL, message });
    // un bloqueo anti-bot es esperable (no es un bug nuestro): aviso, no error
    (isBlock ? console.warn : console.error)(`[${store}]`, e instanceof Error ? e.message : e);
    return { store, status: "error", products: [], ms: Date.now() - t0, message, blocked: isBlock || undefined };
  }
}

/** Mensaje para mostrar y si es un bloqueo anti-bot (no tiene sentido reintentar enseguida). */
export function describeError(e: unknown): { message: string; blocked: boolean } {
  const blocked = e instanceof HttpError && (e.status === 401 || e.status === 403 || e.status === 429);
  const message =
    e instanceof HttpError
      ? e.message
      : e instanceof Error && e.name === "TimeoutError"
        ? "La tienda tardó demasiado en responder"
        : "No se pudo consultar la tienda";
  return { message, blocked };
}

/** Guarda el más barato del día para el historial. No bloquea la respuesta y nunca la rompe. */
function remember(store: StoreId, query: string, best: { price: number; title: string; url: string }) {
  getDb()
    .recordSnapshots([{ day: arDay(), query: normalize(query), store, price: best.price, title: best.title, url: best.url }])
    .catch((e) => console.warn("[historial]", e instanceof Error ? e.message : e));
}
