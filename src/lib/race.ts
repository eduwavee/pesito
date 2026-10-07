import type { Product, StoreId } from "./types";

/** Producto más barato de cada tienda. */
export function bestByStore(products: Product[]): Map<StoreId, Product> {
  const m = new Map<StoreId, Product>();
  for (const p of products) {
    const cur = m.get(p.store);
    if (!cur || p.price < cur.price) m.set(p.store, p);
  }
  return m;
}

/**
 * Recorre las tiendas en el orden en que respondieron y devuelve cada vez que
 * apareció un precio menor: el último es el ganador, los anteriores se tachan.
 */
export function raceSteps(arrivals: StoreId[], best: Map<StoreId, Product>): Product[] {
  const steps: Product[] = [];
  for (const s of arrivals) {
    const p = best.get(s);
    if (p && (!steps.length || p.price < steps[steps.length - 1].price)) steps.push(p);
  }
  return steps;
}
