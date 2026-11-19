import type { Snapshot } from "./db/types";
import { STORES } from "./stores/meta";
import type { StoreId } from "./types";

export interface Drop {
  query: string;
  day: string;
  price: number;
  store: StoreId;
  title: string;
  url: string;
  /** el mínimo del último día anterior con datos */
  prevDay: string;
  prevPrice: number;
  /** cuánto bajó, en % (entero) */
  pct: number;
  /** es el precio más bajo de todo el período que miramos */
  lowest: boolean;
}

interface Opts {
  /** día de referencia (YYYY-MM-DD, hora argentina) */
  today: string;
  /** solo cuenta si el precio de hoy es de hoy o de ayer */
  freshDays?: number;
  /** comparamos contra el último día con datos dentro de esta ventana */
  lookbackDays?: number;
  minPct?: number;
  /**
   * Una "baja" enorme casi siempre es otro producto que matcheó la búsqueda
   * (un cable, una versión usada): la descartamos en vez de mostrar algo falso.
   */
  maxPct?: number;
  limit?: number;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Búsquedas cuyo precio más bajo (entre todas las tiendas) bajó respecto del
 * último día anterior que tenemos registrado.
 */
export function findDrops(
  snapshots: Snapshot[],
  { today, freshDays = 1, lookbackDays = 14, minPct = 3, maxPct = 50, limit = 12 }: Opts,
): Drop[] {
  // mínimo por (búsqueda, día) entre las tiendas que seguimos comparando
  const best = new Map<string, Map<string, Snapshot>>();
  for (const s of snapshots) {
    if (!(s.store in STORES)) continue;
    const days = best.get(s.query) ?? new Map<string, Snapshot>();
    const cur = days.get(s.day);
    if (!cur || s.price < cur.price) days.set(s.day, s);
    best.set(s.query, days);
  }

  const out: Drop[] = [];
  const freshFrom = addDays(today, -freshDays);
  for (const [query, days] of best) {
    const sorted = [...days.keys()].sort();
    const lastDay = sorted.at(-1)!;
    if (lastDay < freshFrom || sorted.length < 2) continue;
    const prevDay = sorted.at(-2)!;
    if (prevDay < addDays(lastDay, -lookbackDays)) continue;
    const now = days.get(lastDay)!;
    const prev = days.get(prevDay)!;
    const pct = Math.round(((prev.price - now.price) / prev.price) * 100);
    if (pct < minPct || pct > maxPct) continue;
    const window = sorted.filter((d) => d >= addDays(lastDay, -lookbackDays));
    out.push({
      query,
      day: lastDay,
      price: now.price,
      store: now.store,
      title: now.title,
      url: now.url,
      prevDay,
      prevPrice: prev.price,
      pct,
      lowest: window.every((d) => days.get(d)!.price >= now.price),
    });
  }
  return out.sort((a, b) => b.pct - a.pct || a.query.localeCompare(b.query)).slice(0, limit);
}
