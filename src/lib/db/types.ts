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

/** Resultado de revisar una tienda (monitor de /estado). */
export interface StoreCheck {
  at: string; // ISO
  store: StoreId;
  /** ok = trajo productos; empty = respondió sin nada (posible cambio de HTML); error = falló */
  status: "ok" | "empty" | "error";
  ms: number;
  count: number;
  message?: string;
  blocked?: boolean;
}

/** Una búsqueda seguida desde un dispositivo con notificaciones push. */
export interface PushFollow {
  query: string;
  /** precio más bajo cuando se empezó a seguir: avisamos si baja de acá */
  basePrice?: number;
  /** último precio por el que avisamos (no repetimos si no baja más) */
  notifiedPrice?: number;
}

/** Suscripción Web Push de un navegador, con lo que sigue ese dispositivo. */
export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
  follows: PushFollow[];
  /** última vez que el cron revisó sus búsquedas */
  checkedAt?: string;
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
  /** Todos los snapshots de los últimos `days` días (para las bajas de precio). */
  recentSnapshots(days: number): Promise<Snapshot[]>;
  recordChecks(rows: StoreCheck[]): Promise<void>;
  /** Chequeos de los últimos `days` días, del más viejo al más nuevo. */
  storeChecks(days: number): Promise<StoreCheck[]>;
  /** Alta o reemplazo (por endpoint) de una suscripción push. */
  savePush(sub: PushSub): Promise<void>;
  deletePush(endpoint: string): Promise<void>;
  pushSubs(): Promise<PushSub[]>;
}
