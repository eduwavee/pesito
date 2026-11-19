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
  rockethard: {
    name: "RocketHard",
    color: "#C83E75",
    home: "https://rockethard.com.ar",
    search: (q) => `https://rockethard.com.ar/buscar/?q=${encodeURIComponent(q).replace(/%20/g, "+")}`,
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
  goldentech: {
    name: "Goldentech",
    color: "#0B7A3B",
    home: "https://goldentechstore.com.ar",
    search: (q) => `https://goldentechstore.com.ar/?s=${encodeURIComponent(q)}&post_type=product`,
  },
  spacegamer: {
    name: "Space Gamer",
    color: "#3F4A5A",
    home: "https://spacegamer.com.ar",
    search: (q) => `https://spacegamer.com.ar/Buscar/${encodeURIComponent(q)}`,
  },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];

const NUMBERS = ["ninguna", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
/** "seis": para los textos ("en seis tiendas argentinas"), así no quedan desactualizados al sumar o sacar una. */
export const STORE_COUNT = NUMBERS[STORE_IDS.length] ?? String(STORE_IDS.length);
/** "Mercado Libre, Compra Gamer, … y Frávega" */
export const STORE_LIST = (() => {
  const names = STORE_IDS.map((s) => STORES[s].name);
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
})();
