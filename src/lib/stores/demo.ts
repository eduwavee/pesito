import type { Product, StoreId } from "../types";

/**
 * Datos de ejemplo para DEMO_MODE=1 (desarrollo offline o deploy donde las tiendas bloquean la IP).
 * Precios inventados a partir de una base, solo para ver la UI.
 */
const FACTOR: Record<StoreId, number> = {
  mercadolibre: 1.08,
  compragamer: 0.97,
  fullh4rd: 1.0,
  venex: 0.95,
  mexx: 1.03,
  gezatek: 0.99,
};

export function demoResults(store: StoreId, query: string): Product[] {
  const base = 300_000 + (hash(query.toLowerCase()) % 700_000);
  const variants = ["", " OC", " Gaming 8GB", " Pro Edition"];
  return variants.map((v, i) => {
    const price = Math.round((base * FACTOR[store] * (1 + i * 0.07)) / 100) * 100;
    return {
      id: `demo-${store}-${i}`,
      store,
      title: `${query.toUpperCase()}${v}`,
      price,
      listPrice: i % 2 ? Math.round(price * 1.12) : undefined,
      url: "#",
      inStock: i !== 3,
      badge: "Demo",
    };
  });
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
