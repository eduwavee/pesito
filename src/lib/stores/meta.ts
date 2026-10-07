import type { StoreId } from "../types";

/** Info pública de cada tienda (se usa en cliente y servidor). */
export const STORES: Record<StoreId, { name: string; color: string; home: string; search: (q: string) => string }> = {
  mercadolibre: {
    name: "Mercado Libre",
    color: "#FFE600",
    home: "https://www.mercadolibre.com.ar",
    search: (q) => `https://listado.mercadolibre.com.ar/${encodeURIComponent(q.trim().replace(/\s+/g, "-"))}`,
  },
  compragamer: {
    name: "Compra Gamer",
    color: "#FF6A00",
    home: "https://compragamer.com",
    search: (q) => `https://compragamer.com/productos?criterio=${encodeURIComponent(q)}`,
  },
  fullh4rd: {
    name: "FullH4rd",
    color: "#E10600",
    home: "https://fullh4rd.com.ar",
    search: (q) => `https://fullh4rd.com.ar/cat/search/${encodeURIComponent(q)}`,
  },
  venex: {
    name: "Venex",
    color: "#0057B8",
    home: "https://www.venex.com.ar",
    search: (q) => `https://www.venex.com.ar/resultado-busqueda.htm?keywords=${encodeURIComponent(q)}`,
  },
  mexx: {
    name: "Mexx",
    color: "#00A3E0",
    home: "https://www.mexx.com.ar",
    search: (q) => `https://www.mexx.com.ar/buscar/?p=${encodeURIComponent(q)}`,
  },
  gezatek: {
    name: "Gezatek",
    color: "#8B5CF6",
    home: "https://gezatek.com.ar",
    search: (q) => `https://gezatek.com.ar/buscar/?q=${encodeURIComponent(q)}`,
  },
  fravega: {
    name: "Frávega",
    color: "#440099",
    home: "https://www.fravega.com",
    search: (q) => `https://www.fravega.com/l/?keyword=${encodeURIComponent(q)}`,
  },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];
