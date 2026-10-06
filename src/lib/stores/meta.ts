import type { StoreId } from "../types";

/** Info pública de cada tienda (se usa en cliente y servidor). */
export const STORES: Record<StoreId, { name: string; color: string; home: string }> = {
  mercadolibre: { name: "Mercado Libre", color: "#FFE600", home: "https://www.mercadolibre.com.ar" },
  compragamer: { name: "Compra Gamer", color: "#FF6A00", home: "https://compragamer.com" },
  fullh4rd: { name: "FullH4rd", color: "#E10600", home: "https://fullh4rd.com.ar" },
  venex: { name: "Venex", color: "#0057B8", home: "https://www.venex.com.ar" },
  mexx: { name: "Mexx", color: "#00A3E0", home: "https://www.mexx.com.ar" },
  gezatek: { name: "Gezatek", color: "#8B5CF6", home: "https://gezatek.com.ar" },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];
