import { arDay, type Db, type StoreCheck } from "./db";
import { escapeHtml, sendMail, siteUrl } from "./mail";
import { ADAPTERS, describeError } from "./stores";
import { demoResults } from "./stores/demo";
import { STORE_IDS, STORES } from "./stores/meta";
import type { StoreId } from "./types";

/**
 * Búsquedas de prueba: productos que cualquier tienda de hardware tiene siempre.
 * Van directo al adapter (sin cache ni historial) para no ensuciar las sugerencias.
 */
export const PROBES = ["mouse logitech", "ryzen 5 7600"];

/** Revisa una tienda: ok si alguna prueba trae productos. */
export async function probeStore(store: StoreId, probes = PROBES): Promise<StoreCheck> {
  const at = new Date().toISOString();
  const t0 = Date.now();
  if (process.env.DEMO_MODE === "1") {
    return { at, store, status: "ok", ms: 0, count: demoResults(store, probes[0]).length };
  }
  let lastError: { message: string; blocked: boolean } | undefined;
  for (const q of probes) {
    try {
      const products = await ADAPTERS[store].search(q, 10);
      if (products.length) return { at, store, status: "ok", ms: Date.now() - t0, count: products.length };
    } catch (e) {
      lastError = describeError(e);
      // si nos bloquearon, la segunda prueba no va a andar mejor
      if (lastError.blocked) break;
    }
  }
  const ms = Date.now() - t0;
  if (lastError) {
    return { at, store, status: "error", ms, count: 0, message: lastError.message, blocked: lastError.blocked || undefined };
  }
  return { at, store, status: "empty", ms, count: 0, message: "Respondió pero sin productos: puede haber cambiado su HTML" };
}

export type DayStatus = "ok" | "partial" | "down" | "none";

export interface StoreHealth {
  store: StoreId;
  current?: StoreCheck;
  /** última vez que respondió bien */
  lastOk?: string;
  /** uno por día, del más viejo al de hoy */
  days: { day: string; status: DayStatus }[];
  /** % de chequeos ok en el período; undefined si no hay chequeos */
  uptime?: number;
  /** promedio de respuesta de los chequeos ok, en ms */
  avgMs?: number;
}

/** Arma el resumen por tienda a partir de los chequeos guardados. */
export function healthReport(checks: StoreCheck[], days = 14, now = new Date()): StoreHealth[] {
  const dayList = Array.from({ length: days }, (_, i) => arDay(new Date(now.getTime() - (days - 1 - i) * 864e5)));
  return STORE_IDS.map((store) => {
    const mine = checks.filter((c) => c.store === store).sort((a, b) => a.at.localeCompare(b.at));
    const oks = mine.filter((c) => c.status === "ok");
    const byDay = new Map<string, StoreCheck[]>();
    for (const c of mine) {
      const d = arDay(new Date(c.at));
      byDay.set(d, [...(byDay.get(d) ?? []), c]);
    }
    return {
      store,
      current: mine.at(-1),
      lastOk: oks.at(-1)?.at,
      days: dayList.map((day) => {
        const list = byDay.get(day) ?? [];
        const good = list.filter((c) => c.status === "ok").length;
        const status: DayStatus = !list.length ? "none" : good === list.length ? "ok" : good ? "partial" : "down";
        return { day, status };
      }),
      uptime: mine.length ? Math.round((oks.length / mine.length) * 100) : undefined,
      avgMs: oks.length ? Math.round(oks.reduce((s, c) => s + c.ms, 0) / oks.length) : undefined,
    };
  });
}

/** Qué tiendas se rompieron o se arreglaron respecto del chequeo anterior. */
export function transitions(previous: StoreCheck[], next: StoreCheck[]) {
  const last = new Map<StoreId, StoreCheck>();
  for (const c of [...previous].sort((a, b) => a.at.localeCompare(b.at))) last.set(c.store, c);
  const broke: StoreCheck[] = [];
  const recovered: StoreCheck[] = [];
  for (const c of next) {
    const before = last.get(c.store);
    if (!before) continue; // primera vez: no sabemos si "cambió"
    if (before.status === "ok" && c.status !== "ok") broke.push(c);
    if (before.status !== "ok" && c.status === "ok") recovered.push(c);
  }
  return { broke, recovered };
}

/**
 * Revisa todas las tiendas, guarda el resultado y, si alguna cambió de estado,
 * avisa por mail a MONITOR_EMAIL (si está configurado).
 */
export async function runHealthCheck(db: Db): Promise<StoreCheck[]> {
  const previous = await db.storeChecks(3);
  const checks = await Promise.all(STORE_IDS.map((s) => probeStore(s)));
  await db.recordChecks(checks);
  const { broke, recovered } = transitions(previous, checks);
  const to = process.env.MONITOR_EMAIL;
  if (to && (broke.length || recovered.length)) {
    const names = (list: StoreCheck[]) => list.map((c) => STORES[c.store].name).join(", ");
    const subject = broke.length
      ? `Pesito: dejó de andar ${names(broke)}`
      : `Pesito: volvió a andar ${names(recovered)}`;
    const lines = [
      ...broke.map((c) => `<li><b>${escapeHtml(STORES[c.store].name)}</b> falló: ${escapeHtml(c.message ?? c.status)}</li>`),
      ...recovered.map((c) => `<li><b>${escapeHtml(STORES[c.store].name)}</b> volvió a responder (${c.count} productos)</li>`),
    ];
    await sendMail(
      to,
      subject,
      `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#16171a">
<p style="font-weight:700">Monitor de tiendas</p><ul>${lines.join("")}</ul>
<p><a href="${siteUrl()}/estado">Ver el estado de todas las tiendas</a></p></body></html>`,
    ).catch((e) => console.warn("[monitor] no se pudo mandar el aviso", e instanceof Error ? e.message : e));
  }
  for (const c of broke) console.warn(`[monitor] ${c.store} dejó de andar: ${c.message ?? c.status}`);
  return checks;
}
