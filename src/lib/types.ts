export type StoreId =
  | "mercadolibre"
  | "compragamer"
  | "fullh4rd"
  | "venex"
  | "mexx"
  | "gezatek"
  | "fravega";

export interface Product {
  id: string;
  store: StoreId;
  title: string;
  /** Precio principal (contado / transferencia si la tienda lo distingue) en ARS */
  price: number;
  /** Moneda del precio. Hoy todas las tiendas publican en pesos; la completa `searchStore`. */
  currency?: "ARS";
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
}

export type StoreStatus = "ok" | "empty" | "error" | "disabled";

/**
 * Por qué falló una tienda (solo cuando status = "error").
 * "Página sin resultados" no es un error: es status = "empty".
 */
export type StoreErrorKind =
  /** No se pudo establecer la conexión (DNS, red caída, conexión rechazada o cortada) */
  | "connection"
  /** La tienda no contestó dentro del tiempo límite */
  | "timeout"
  /** La tienda rechazó la consulta: 401 / 403 / 429, desafío anti-bot o pedido de login */
  | "blocked"
  /** Otro error HTTP (404, 5xx...) */
  | "http"
  /** Respondió, pero la página ya no tiene la estructura que el extractor espera */
  | "structure"
  /** Respondió 200 con el cuerpo vacío */
  | "empty-response"
  /** Los datos llegaron pero no se pudieron procesar (JSON inválido, productos sin precio, bug nuestro) */
  | "processing";

export interface StoreResult {
  store: StoreId;
  status: StoreStatus;
  products: Product[];
  ms: number;
  cached?: boolean;
  /** Datos de ejemplo (DEMO_MODE), no precios reales */
  demo?: boolean;
  message?: string;
  /** Causa del error, para no mostrar "no respondió" a todo */
  errorKind?: StoreErrorKind;
  /** La tienda nos bloqueó (anti-bot): no tiene sentido reintentar enseguida */
  blocked?: boolean;
}

export interface StoreAdapter {
  id: StoreId;
  search(query: string, limit: number): Promise<Product[]>;
}
