import type { StoreId } from "../types";

/** Precio más bajo de una tienda para una búsqueda, en un día. */
export interface Snapshot {
  day: string; // YYYY-MM-DD (hora argentina)
  query: string; // normalizada
  store: StoreId;
  price: number;
  title: string;
  url: string;
}

export interface Alert {
  id: string;
  /** para darse de baja sin cuenta */
  token: string;
  email: string;
  query: string;
  target: number;
  createdAt: string;
  active: boolean;
  /** último precio por el que avisamos (no repetimos si no baja más) */
  notifiedPrice?: number;
}

export interface SavedBuild {
  /** el armado codificado (la query string de /armar) */
  key: string;
  total: number;
  parts: number;
  count: number;
  lastAt: string;
}

export interface Db {
  readonly kind: "postgres" | "file" | "memory";
  recordSnapshots(rows: Snapshot[]): Promise<void>;
  history(query: string, days: number): Promise<Snapshot[]>;
  /** Búsquedas más hechas (cuántos días/tiendas tienen registro), para sugerirlas. */
  topQueries(limit: number): Promise<{ query: string; count: number }[]>;
  addAlert(a: Alert): Promise<void>;
  activeAlerts(): Promise<Alert[]>;
  updateAlert(id: string, patch: Partial<Pick<Alert, "active" | "notifiedPrice">>): Promise<void>;
  getAlert(id: string): Promise<Alert | undefined>;
  recordBuild(b: Omit<SavedBuild, "count" | "lastAt">): Promise<void>;
  popularBuilds(limit: number): Promise<SavedBuild[]>;
}
