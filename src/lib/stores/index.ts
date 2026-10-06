import { cached } from "../cache";
import { HttpError } from "../http";
import { matchesQuery } from "../text";
import type { StoreAdapter, StoreId, StoreResult } from "../types";
import { compragamer } from "./compragamer";
import { demoResults } from "./demo";
import { fullh4rd } from "./fullh4rd";
import { gezatek } from "./gezatek";
import { mercadolibre } from "./mercadolibre";
import { mexx } from "./mexx";
import { venex } from "./venex";

export const ADAPTERS: Record<StoreId, StoreAdapter> = {
  mercadolibre,
  compragamer,
  fullh4rd,
  venex,
  mexx,
  gezatek,
};

const TTL = 10 * 60_000;
const LIMIT = 24;

export async function searchStore(store: StoreId, rawQuery: string): Promise<StoreResult> {
  const query = rawQuery.trim().slice(0, 80);
  const t0 = Date.now();
  if (process.env.DEMO_MODE === "1") {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 1200));
    return { store, status: "ok", products: demoResults(store, query), ms: Date.now() - t0 };
  }
  try {
    const { value, hit } = await cached(`q:${store}:${query.toLowerCase()}`, TTL, () =>
      ADAPTERS[store].search(query, LIMIT * 2),
    );
    // los buscadores de las tiendas son "generosos": filtramos lo que no tiene todas las palabras
    const products = value
      .filter((p) => matchesQuery(p.title, query))
      .sort((a, b) => a.price - b.price)
      .slice(0, LIMIT);
    return {
      store,
      status: products.length ? "ok" : "empty",
      products,
      ms: Date.now() - t0,
      cached: hit,
    };
  } catch (e) {
    const message =
      e instanceof HttpError
        ? e.message
        : e instanceof Error && e.name === "TimeoutError"
          ? "La tienda tardó demasiado en responder"
          : "No se pudo consultar la tienda";
    console.error(`[${store}]`, e);
    return { store, status: "error", products: [], ms: Date.now() - t0, message };
  }
}
