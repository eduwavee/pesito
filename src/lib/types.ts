export type StoreId =
  | "mercadolibre"
  | "compragamer"
  | "fullh4rd"
  | "venex"
  | "mexx"
  | "gezatek";

export interface Product {
  id: string;
  store: StoreId;
  title: string;
  /** Precio principal (contado / transferencia si la tienda lo distingue) en ARS */
  price: number;
  /** Precio de lista / tachado, si existe */
  listPrice?: number;
  url: string;
  image?: string;
  brand?: string;
  inStock?: boolean;
  /** Etiqueta corta, ej: "Contado", "Full", "Envío gratis" */
  badge?: string;
}

export type StoreStatus = "ok" | "empty" | "error" | "disabled";

export interface StoreResult {
  store: StoreId;
  status: StoreStatus;
  products: Product[];
  ms: number;
  cached?: boolean;
  message?: string;
}

export interface StoreAdapter {
  id: StoreId;
  search(query: string, limit: number): Promise<Product[]>;
}
