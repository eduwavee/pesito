import { STORE_IDS } from "./stores/meta";
import type { StoreId, StoreResult } from "./types";

/** Cache del navegador: volver a un paso o repetir una búsqueda no vuelve a pedir nada. */
const cache = new Map<string, Promise<StoreResult>>();

export function searchStore(store: StoreId, query: string): Promise<StoreResult> {
  const key = `${store}:${query.trim().toLowerCase()}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = fetch(`/api/search/${store}?q=${encodeURIComponent(query.trim())}`)
      .then((r) => r.json() as Promise<StoreResult>)
      .catch((): StoreResult => ({ store, status: "error", products: [], ms: 0, message: "Error de red" }));
    cache.set(key, hit);
    // los errores no se cachean: se puede reintentar
    hit.then((r) => r.status === "error" && cache.delete(key));
  }
  return hit;
}

/** Busca en todas las tiendas; `onResult` se llama apenas responde cada una. */
export function searchAll(query: string, onResult?: (r: StoreResult) => void): Promise<StoreResult[]> {
  return Promise.all(
    STORE_IDS.map((s) =>
      searchStore(s, query).then((r) => {
        onResult?.(r);
        return r;
      }),
    ),
  );
}
