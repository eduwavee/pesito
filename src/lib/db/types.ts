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
  /** el cron la revisa; arranca en false hasta que confirman el mail */
  active: boolean;
  /** cuándo confirmaron desde el link del mail (sin esto la alerta está pendiente) */
  confirmedAt?: string;
  /** última vez que el cron buscó su precio (para repartir el trabajo entre días) */
  checkedAt?: string;
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
  /** Todas las de un mail (activas, pendientes y dadas de baja). */
  alertsByEmail(email: string): Promise<Alert[]>;
  updateAlert(
    id: string,
    patch: Partial<Pick<Alert, "active" | "notifiedPrice" | "confirmedAt" | "checkedAt">>,
  ): Promise<void>;
  getAlert(id: string): Promise<Alert | undefined>;
  recordBuild(b: Omit<SavedBuild, "count" | "lastAt">): Promise<void>;
  popularBuilds(limit: number): Promise<SavedBuild[]>;
}
