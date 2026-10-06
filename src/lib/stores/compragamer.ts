import { cached } from "../cache";
import { getJson } from "../http";
import { matchesQuery } from "../text";
import type { Product, StoreAdapter } from "../types";

/**
 * Compra Gamer es una SPA (Angular) que baja TODO el catálogo de un JSON público
 * y filtra en el navegador. Hacemos lo mismo: lo cacheamos 15 min y filtramos acá.
 */
interface CgProduct {
  id_producto: number;
  nombre: string;
  precioEspecial: number; // contado / transferencia
  precioLista: number;
  vendible: number;
  stock: number;
  imagenes?: { nombre: string; orden: number }[];
  visible_solo_en_combo?: boolean;
  visible_solo_en_ATPC?: boolean;
}

const CATALOG_URL = "https://static.compragamer.com/productos";
const IMG_BASE = "https://imagenes.compragamer.com/productos/compragamer_Imganen_general_";

function slug(nombre: string) {
  return nombre.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function catalog(): Promise<CgProduct[]> {
  const { value } = await cached("cg:catalog", 15 * 60_000, () =>
    getJson<CgProduct[]>(CATALOG_URL, { timeoutMs: 20_000 }),
  );
  return value;
}

export const compragamer: StoreAdapter = {
  id: "compragamer",
  async search(query, limit) {
    const all = await catalog();
    const out: Product[] = [];
    for (const p of all) {
      if (!p.vendible || p.visible_solo_en_combo || p.visible_solo_en_ATPC) continue;
      if (!matchesQuery(p.nombre, query)) continue;
      const img = [...(p.imagenes ?? [])].sort((a, b) => a.orden - b.orden)[0];
      out.push({
        id: `cg-${p.id_producto}`,
        store: "compragamer",
        title: p.nombre,
        price: Math.round(p.precioEspecial),
        listPrice: p.precioLista > p.precioEspecial ? Math.round(p.precioLista) : undefined,
        url: `https://compragamer.com/producto/${slug(p.nombre)}_${p.id_producto}`,
        image: img ? `${IMG_BASE}${img.nombre}-grn.jpg` : undefined,
        inStock: p.stock > 0,
        badge: "Precio contado",
      });
    }
    return out.sort((a, b) => a.price - b.price).slice(0, limit);
  },
};
