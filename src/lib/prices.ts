import { searchStore } from "./stores";
import { STORE_IDS } from "./stores/meta";
import { isComparable, type Product } from "./types";
import { isExactModel } from "./variants";
import { guessKind } from "./versus";

/**
 * El más barato de una búsqueda entre todas las tiendas (server). Solo cuenta lo comparable:
 * nuevo, del formato buscado y, en placas y procesadores, del modelo exacto ("RTX 5060" no
 * es una 5060 Ti). Las búsquedas por tienda ya tienen su cache de 10 minutos.
 */
export async function cheapestOf(query: string): Promise<Product | undefined> {
  const results = await Promise.all(STORE_IDS.map((s) => searchStore(s, query)));
  const kind = guessKind(query);
  const exact = kind === "gpu" || kind === "cpu";
  return results
    .flatMap((r) => r.products)
    .filter((p) => isComparable(p) && p.inStock !== false && (!exact || isExactModel(p.title, query)))
    .sort((a, b) => a.price - b.price)[0];
}
