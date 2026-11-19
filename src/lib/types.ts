export type StoreId =
  | "mercadolibre"
  | "compragamer"
  | "rockethard"
  | "mexx"
  | "gezatek"
  | "fravega"
  | "goldentech"
  | "spacegamer";

export interface Product {
  id: string;
  store: StoreId;
  title: string;
  /** Precio principal (contado / transferencia si la tienda lo distingue) en ARS */
  price: number;
  /** Precio de lista / tachado, si existe */
  listPrice?: number;
  /** Precio pagando con tarjeta / en cuotas, cuando la tienda lo publica aparte del contado */
  cardPrice?: number;
  url: string;
  image?: string;
  brand?: string;
  inStock?: boolean;
  /** true / false solo cuando la tienda lo informa; undefined = no sabemos */
  freeShipping?: boolean;
  /** Etiqueta corta, ej: "Contado", "Full", "Envío gratis" */
  badge?: string;
  /** Usado, reacondicionado u open box: se ocultan por defecto */
  used?: boolean;
  /** Memoria de notebook (SODIMM) cuando no se buscó eso: otro formato, se oculta por defecto */
  notebook?: boolean;
}

/** Lo que comparamos por defecto: nuevo y del formato que se buscó (ver `isUsed` / `isNotebookRam`). */
export const isComparable = (p: Pick<Product, "used" | "notebook">) => !p.used && !p.notebook;

export type StoreStatus = "ok" | "empty" | "error" | "disabled";

export interface StoreResult {
  store: StoreId;
  status: StoreStatus;
  products: Product[];
  ms: number;
  cached?: boolean;
  /** Datos de ejemplo (DEMO_MODE), no precios reales */
  demo?: boolean;
  message?: string;
  /** La tienda nos bloqueó (anti-bot): no tiene sentido reintentar enseguida */
  blocked?: boolean;
}

export interface StoreAdapter {
  id: StoreId;
  search(query: string, limit: number): Promise<Product[]>;
}
