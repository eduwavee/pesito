import { STORE_IDS } from "../stores/meta";
import type { Product, StoreId } from "../types";
import { fitFor, type Fit } from "./compat";
import { PART_IDS, fitsCategory, partDef, qtyOf, slotPrice, type Build, type PartId } from "./parts";

export type RankedOffer = { product: Product; fit: Fit };

const fitOrder = { ok: 0, unknown: 1, bad: 2 } as const;

/**
 * Un accesorio que se cuela (un tornillo, un servicio) sale mucho más barato que la pieza real:
 * con 5 ofertas o más, descartamos las que valen menos del 20 % de la mediana.
 */
function dropOutliers(products: Product[]): Product[] {
  if (products.length < 5) return products;
  const prices = products.map((p) => p.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  return products.filter((p) => p.price >= median * 0.2);
}

/** Ofertas de una categoría: solo las que parecen de verdad de esa categoría, compatibles primero y por precio. */
export function rankOffers(part: PartId, products: Product[], build: Build): RankedOffer[] {
  return dropOutliers(products.filter((p) => fitsCategory(part, p)))
    .map((product) => ({ product, fit: fitFor(part, product, build) }))
    .sort((a, b) => fitOrder[a.fit.level] - fitOrder[b.fit.level] || a.product.price - b.product.price);
}

/** La oferta más barata que no choca con el resto del armado. */
export const cheapestFit = (part: PartId, products: Product[], build: Build) =>
  rankOffers(part, products, build).find((o) => o.fit.level !== "bad")?.product;

export function buildTotal(build: Build): number {
  return PART_IDS.reduce((sum, id) => sum + slotPrice(build, id), 0);
}

export const filledCount = (build: Build) => PART_IDS.filter((id) => build[id]?.pick !== undefined).length;

export interface StoreTotal {
  store: StoreId;
  total: number;
  /** piezas que esta tienda no tiene */
  missing: PartId[];
}

/**
 * ¿Cuánto sale comprando todo en una sola tienda? Para cada pieza elegida toma la oferta
 * más barata compatible de esa tienda dentro de la misma búsqueda.
 */
export function oneStoreTotals(offers: Partial<Record<PartId, Product[]>>, build: Build): StoreTotal[] {
  const parts = PART_IDS.filter((id) => build[id]?.pick);
  return STORE_IDS.map((store) => {
    let total = 0;
    const missing: PartId[] = [];
    for (const id of parts) {
      const own = (offers[id] ?? []).filter((p) => p.store === store);
      const best = cheapestFit(id, own, build);
      if (best) total += best.price * qtyOf(build, id);
      else missing.push(id);
    }
    return { store, total, missing };
  }).sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);
}

/* ---------- link para compartir ---------- */

/**
 * `?cpu=Ryzen 5 7600~cg-123&gpu=~&ramx=2` → búsqueda + id elegido; `~` solo = pieza salteada;
 * `<pieza>x` = unidades, solo si son más de una.
 * Al abrir el link se vuelve a buscar y se elige ese id si sigue estando (si no, el más barato).
 */
export function encodeBuild(build: Build): string {
  const params = new URLSearchParams();
  for (const id of PART_IDS) {
    const slot = build[id];
    if (!slot) continue;
    if (slot.pick === null) params.set(id, "~");
    else if (slot.query) params.set(id, `${slot.query}~${slot.pick?.id ?? ""}`);
    const qty = qtyOf(build, id);
    if (slot.pick && qty > 1) params.set(`${id}x`, String(qty));
  }
  return params.toString();
}

export type DecodedSlot = { query: string; pickId?: string; skipped?: boolean; qty?: number };

export function decodeBuild(
  search: string,
): Partial<Record<PartId, DecodedSlot>> {
  const params = new URLSearchParams(search);
  const out: Partial<Record<PartId, DecodedSlot>> = {};
  for (const id of PART_IDS) {
    const raw = params.get(id);
    if (raw === null) continue;
    const i = raw.lastIndexOf("~");
    const query = (i < 0 ? raw : raw.slice(0, i)).trim().slice(0, 80);
    const pickId = i < 0 ? "" : raw.slice(i + 1);
    const qty = Number(params.get(`${id}x`)) || undefined;
    out[id] = raw === "~" ? { query: "", skipped: true } : { query, pickId: pickId || undefined, qty };
  }
  return out;
}

/**
 * Valida un armado que llega de afuera (ranking de populares) y lo devuelve en forma canónica,
 * o null si no es un armado real: claves desconocidas, piezas sin producto elegido, unidades de más.
 */
export function canonicalBuildKey(key: string): string | null {
  const params = new URLSearchParams(key);
  const allowed = new Set(PART_IDS.flatMap((id) => [id, `${id}x`]));
  if ([...params.keys()].some((k) => !allowed.has(k))) return null;
  const slots = decodeBuild(key);
  const out = new URLSearchParams();
  let picked = 0;
  for (const id of PART_IDS) {
    const s = slots[id];
    if (!s) continue;
    if (s.skipped) {
      out.set(id, "~");
      continue;
    }
    if (s.query.length < 2 || !s.pickId || s.pickId.length > 200) return null;
    out.set(id, `${s.query}~${s.pickId}`);
    picked++;
    const qty = params.get(`${id}x`);
    if (qty !== null) {
      const n = Number(qty);
      if (!Number.isInteger(n) || n < 2 || n > (partDef(id).multi ?? 1)) return null;
      out.set(`${id}x`, qty);
    }
  }
  return picked ? out.toString() : null;
}
