import { getHtml, StoreError } from "../http";
import { cleanText } from "../text";
import type { Product, StoreAdapter } from "../types";

const BASE = "https://www.fravega.com";
const IMG = "https://images.fravega.com/f300/";
/** Frávega lista de a 15 y pagina con `&page=N` */
const PAGE_SIZE = 15;
/** Tope de páginas por búsqueda: cada una pesa ~800 KB, no vale la pena pedir más */
const MAX_PAGES = 3;

interface FvItem {
  code?: string;
  item?: { title?: string; slug?: string; images?: string[]; brand?: { name?: string } | null };
  images?: string[];
  marketplace?: boolean;
  seller?: { commercialName?: string };
  pricing?: { salePrice?: number; listPrice?: number };
  /** Modalidades de entrega disponibles, ej. ["HOME_DELIVERY_IN_48_HOURS"] */
  stock?: { labels?: string[] } | null;
  /** Rutas de categoría, de la más específica a la raíz: [[{slug:"informatica/gaming-pc/mouses"}, ...]] */
  categorization?: ({ slug?: string } | null)[][] | null;
}

/** Rubros de Frávega que tienen sentido en un comparador de gaming. */
const GAMING_CATEGORIES = /^(informatica|videojuegos|audio\/auriculares)(\/|$)/;

/**
 * Frávega vende de todo (camping, cocina, salud...) y Pesito es solo de gaming:
 * nos quedamos con informática, videojuegos y auriculares, más lo que el título declara "gamer"
 * (ej. sillas gamer publicadas en Muebles). Sin categoría informada no descartamos nada.
 */
export function isGamingItem(categorySlug: string | undefined, title: string): boolean {
  if (!categorySlug) return true;
  return GAMING_CATEGORIES.test(categorySlug) || /\bgam(er|ing)\b/i.test(title);
}

interface FvPage {
  products: Product[];
  /** Cantidad total de resultados que informa Frávega para la búsqueda */
  total: number;
}

/**
 * Frávega es una app de Next.js: el listado viene entero en el JSON de
 * `__NEXT_DATA__` (estado de Apollo), así que no hace falta leer el DOM.
 *
 * Tira `StoreError` si la página no tiene la forma esperada, para distinguir
 * "Frávega cambió su página" de "la búsqueda no tiene resultados" (total = 0).
 */
export function readFravegaPage(html: string): FvPage {
  const json = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!json) throw new StoreError("structure", "Frávega cambió su página: ya no trae el bloque __NEXT_DATA__");
  let state: Record<string, Record<string, unknown>> | undefined;
  try {
    state = JSON.parse(json)?.props?.pageProps?.__APOLLO_STATE__;
  } catch (e) {
    throw new StoreError("processing", "No se pudo leer el JSON del listado de Frávega", e instanceof Error ? e.message : undefined);
  }
  if (!state || typeof state !== "object") {
    throw new StoreError("structure", "Frávega cambió su página: falta __APOLLO_STATE__ en los datos");
  }
  const root = state.ROOT_QUERY ?? {};
  const key = Object.keys(root).find((k) => k.startsWith("items("));
  const list = root[key ?? ""] as { total?: number; results?: unknown[] } | undefined;
  if (!key || !Array.isArray(list?.results)) {
    throw new StoreError("structure", "Frávega cambió su página: no aparece el listado de productos (items)");
  }
  const results = list.results as (FvItem & { __ref?: string })[];
  const out: Product[] = [];
  const seen = new Set<string>();
  /** Productos que se pudieron leer, sean o no de gaming: para detectar un cambio de estructura */
  let readable = 0;
  for (const raw of results) {
    const it = ((raw?.__ref ? state[raw.__ref] : raw) ?? {}) as FvItem;
    const title = cleanText(it.item?.title);
    const price = it.pricing?.salePrice;
    if (!it.code || !title || !price || !it.item?.slug || seen.has(it.code)) continue;
    seen.add(it.code);
    readable++;
    if (!isGamingItem(it.categorization?.[0]?.[0]?.slug, title)) continue;
    const list = it.pricing?.listPrice ? Math.round(it.pricing.listPrice) : undefined;
    const img = it.images?.[0] ?? it.item.images?.[0];
    out.push({
      id: `fv-${it.code}`,
      store: "fravega",
      title,
      brand: it.item.brand?.name || undefined,
      price: Math.round(price),
      // vienen con decimales: comparamos ya redondeados
      listPrice: list && list > Math.round(price) ? list : undefined,
      url: `${BASE}/p/${it.item.slug}-${it.code}/`,
      image: img ? `${IMG}${img}` : undefined,
      // solo afirmamos stock cuando Frávega informa alguna modalidad de entrega; si no, no sabemos
      inStock: it.stock?.labels?.length ? true : undefined,
      badge: it.marketplace && it.seller?.commercialName ? `Vende ${it.seller.commercialName}` : undefined,
    });
  }
  if (results.length && !readable) {
    throw new StoreError(
      "structure",
      "Frávega cambió su página: los productos ya no traen título, precio o link",
      `${results.length} resultados ilegibles`,
    );
  }
  return { products: out, total: typeof list.total === "number" ? list.total : out.length };
}

/** Exportado para tests con HTML guardado: devuelve [] si la página no se puede leer. */
export function parseFravega(html: string): Product[] {
  try {
    return readFravegaPage(html).products;
  } catch {
    return [];
  }
}

const pageUrl = (query: string, page: number) =>
  `${BASE}/l/?keyword=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ""}`;

export const fravega: StoreAdapter = {
  id: "fravega",
  async search(query, limit) {
    // la primera página manda: si falla, falla la tienda
    const first = readFravegaPage(await getHtml(pageUrl(query, 1)));
    const pages = Math.min(MAX_PAGES, Math.ceil(Math.min(limit, first.total) / PAGE_SIZE));
    // el resto suma resultados si llega; si alguna falla nos quedamos con lo que hay
    const rest = await Promise.allSettled(
      Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
        getHtml(pageUrl(query, i + 2), { timeoutMs: 8_000 }).then(readFravegaPage),
      ),
    );
    const seen = new Set<string>();
    const out: Product[] = [];
    const add = (products: Product[]) => {
      for (const p of products) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
    };
    add(first.products);
    rest.forEach((r, i) => {
      if (r.status === "fulfilled") add(r.value.products);
      else console.warn(`[fravega] página ${i + 2} omitida: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    });
    return out.slice(0, limit);
  },
};
