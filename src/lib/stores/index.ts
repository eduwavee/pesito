import { cached } from "../cache";
import { StoreError } from "../http";
import { arDay, getDb } from "../db";
import { isSecondary, matchesQuery, normalize, storeQuery } from "../text";
import type { Product, StoreAdapter, StoreErrorKind, StoreId, StoreResult } from "../types";
import { compragamer } from "./compragamer";
import { demoResults } from "./demo";
import { fravega } from "./fravega";
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
  fravega,
};

const TTL = 10 * 60_000;
const LIMIT = 24;
/** Si una tienda nos bloquea, no la volvemos a molestar por un rato: respondemos el error al instante. */
const BLOCKED_TTL = 5 * 60_000;
const blocked = new Map<StoreId, { until: number; message: string }>();

/** Cualquier excepción de un extractor termina con una causa concreta. */
function toStoreError(e: unknown): StoreError {
  if (e instanceof StoreError) return e;
  const err = e instanceof Error ? e : new Error(String(e));
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    return new StoreError("timeout", "La tienda tardó demasiado en responder");
  }
  // un TypeError / SyntaxError dentro del extractor: llegaron datos que no supimos leer
  return new StoreError("processing", "No se pudieron procesar los datos de la tienda", `${err.name}: ${err.message}`);
}

/**
 * Contrato común de todas las tiendas hacia el comparador: título, precio entero en ARS
 * y link absoluto; sin repetidos. Lo que no lo cumple se descarta (nunca se inventa un precio).
 */
function sanitize(store: StoreId, raw: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of raw) {
    const price = Math.round(p.price);
    if (!p.id || !p.title?.trim() || !Number.isFinite(price) || price <= 0 || !/^https?:\/\//.test(p.url ?? "")) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ ...p, price, currency: "ARS" });
  }
  if (raw.length && !out.length) {
    throw new StoreError(
      "processing",
      "La tienda devolvió productos sin precio o sin link válido",
      `${raw.length} productos descartados`,
    );
  }
  if (out.length < raw.length) console.info(`[${store}] se descartaron ${raw.length - out.length} productos repetidos o incompletos`);
  return out;
}

function log(store: StoreId, query: string, ms: number, outcome: string, kind?: StoreErrorKind, detail?: string) {
  const line = `[${store}] ${kind ? `error:${kind}` : outcome} q="${query}" ${ms}ms${kind ? ` — ${outcome}` : ""}${detail ? ` (${detail})` : ""}`;
  // un bloqueo o un corte de la tienda es esperable (no es un bug nuestro): aviso, no error
  if (!kind) console.info(line);
  else if (kind === "structure" || kind === "processing") console.error(line);
  else console.warn(line);
}

export async function searchStore(store: StoreId, rawQuery: string): Promise<StoreResult> {
  const query = rawQuery.trim().slice(0, 80);
  const t0 = Date.now();
  if (process.env.DEMO_MODE === "1") {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 1200));
    return { store, status: "ok", products: demoResults(store, query), ms: Date.now() - t0, demo: true };
  }
  const block = blocked.get(store);
  if (block && block.until > t0) {
    return { store, status: "error", products: [], ms: 0, message: block.message, errorKind: "blocked", blocked: true };
  }
  try {
    const sq = storeQuery(query);
    const { value, hit } = await cached(`q:${store}:${sq}`, TTL, async () =>
      sanitize(store, await ADAPTERS[store].search(sq, LIMIT * 2)),
    );
    // los buscadores de las tiendas son "generosos": filtramos lo que no tiene todas las palabras
    const matches = value.filter((p) => matchesQuery(p.title, query));
    // fundas, notebooks que "traen" lo buscado, etc. solo si no hay nada mejor
    const main = matches.filter((p) => !isSecondary(p.title, query));
    const products = (main.length ? main : matches).sort((a, b) => a.price - b.price).slice(0, LIMIT);
    if (products[0]) remember(store, query, products[0]);
    if (!hit) {
      log(
        store,
        query,
        Date.now() - t0,
        products.length
          ? `ok ${products.length} productos (${value.length} extraídos)`
          : value.length
            ? `sin resultados: ${value.length} extraídos, ninguno coincide con la búsqueda`
            : "sin resultados: la tienda no devolvió productos",
      );
    }
    return {
      store,
      status: products.length ? "ok" : "empty",
      products,
      ms: Date.now() - t0,
      cached: hit,
    };
  } catch (e) {
    const err = toStoreError(e);
    const isBlock = err.kind === "blocked";
    const ms = Date.now() - t0;
    if (isBlock) blocked.set(store, { until: Date.now() + BLOCKED_TTL, message: err.message });
    log(store, query, ms, err.message, err.kind, err.detail);
    return {
      store,
      status: "error",
      products: [],
      ms,
      message: err.message,
      errorKind: err.kind,
      blocked: isBlock || undefined,
    };
  }
}

/** Guarda el más barato del día para el historial. No bloquea la respuesta y nunca la rompe. */
function remember(store: StoreId, query: string, best: { price: number; title: string; url: string }) {
  getDb()
    .recordSnapshots([{ day: arDay(), query: normalize(query), store, price: best.price, title: best.title, url: best.url }])
    .catch((e) => console.warn("[historial]", e instanceof Error ? e.message : e));
}
