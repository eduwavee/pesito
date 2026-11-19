import { arDay, getDb, type Alert, type PushSub } from "@/lib/db";
import { formatArs, formatNum } from "@/lib/format";
import { runHealthCheck } from "@/lib/health";
import { priceMail, sendMail, siteUrl } from "@/lib/mail";
import { evaluateFollows, pushConfigured, sendPush } from "@/lib/push";
import { searchStore } from "@/lib/stores";
import { STORE_IDS, STORES } from "@/lib/stores/meta";
import { normalize } from "@/lib/text";
import { isNew, type Product } from "@/lib/types";

export const maxDuration = 60;
/** búsquedas a la vez (cada una consulta todas las tiendas en paralelo) */
const CONCURRENCY = 3;
/** dejamos de arrancar búsquedas nuevas pasado este tiempo, con margen antes de maxDuration */
const BUDGET_MS = 40_000;
/** búsquedas populares que refrescamos para tener historial y bajas de precio */
const POPULAR = 20;

interface Job {
  query: string;
  alerts: Alert[];
  subs: PushSub[];
  /** última revisión (0 = nunca): las más viejas primero */
  last: number;
}

/**
 * Una vez por día (vercel.json):
 *  1. revisa que cada tienda responda (monitor de /estado, avisa si alguna se rompe);
 *  2. vuelve a buscar lo que alguien sigue (alertas por mail y avisos push) y avisa si bajó;
 *  3. con el tiempo que sobra, refresca las búsquedas populares para el historial y las bajas.
 * Si no entra todo en una corrida, sigue al otro día por las que hace más que no se revisan.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    console.error("[cron] falta CRON_SECRET: no corremos sin protección");
    return Response.json({ error: "Falta configurar CRON_SECRET" }, { status: 503 });
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const t0 = Date.now();
  const db = getDb();
  const health = runHealthCheck(db).catch((e) => {
    console.error("[cron] monitor:", e instanceof Error ? e.message : e);
    return [];
  });

  const [alerts, subs, top, today] = await Promise.all([
    db.activeAlerts(),
    pushConfigured() ? db.pushSubs() : Promise.resolve([]),
    db.topQueries(POPULAR).catch(() => []),
    db.recentSnapshots(1).catch(() => []),
  ]);

  const jobs = new Map<string, Job>();
  const job = (query: string) => {
    const key = normalize(query);
    let j = jobs.get(key);
    if (!j) jobs.set(key, (j = { query, alerts: [], subs: [], last: Infinity }));
    return j;
  };
  for (const a of alerts) {
    const j = job(a.query);
    j.alerts.push(a);
    j.last = Math.min(j.last, a.checkedAt ? Date.parse(a.checkedAt) : 0);
  }
  for (const s of subs) {
    for (const f of s.follows) {
      const j = job(f.query);
      j.subs.push(s);
      j.last = Math.min(j.last, s.checkedAt ? Date.parse(s.checkedAt) : 0);
    }
  }
  // primero lo que alguien sigue (las que nunca se revisaron, después las más viejas)
  const queue = [...jobs.values()].sort((a, b) => a.last - b.last);
  // después las populares que todavía no tienen precio de hoy
  const doneToday = new Set(today.filter((s) => s.day === arDay()).map((s) => s.query));
  const popular = top.map((t) => t.query).filter((q) => !jobs.has(normalize(q)) && !doneToday.has(q));
  for (const q of popular) queue.push({ query: q, alerts: [], subs: [], last: Infinity });

  const base = siteUrl();
  const now = new Date().toISOString();
  const touchedSubs = new Map<string, PushSub>();
  const goneSubs = new Set<string>();
  let mails = 0;
  let pushes = 0;
  let checked = 0;

  async function check(j: Job) {
    // searchStore guarda el mínimo del día por tienda: esto alimenta historial y bajas
    const results = await Promise.all(STORE_IDS.map((s) => searchStore(s, j.query)));
    const best: Product | undefined = results.flatMap((r) => r.products).filter(isNew).sort((a, b) => a.price - b.price)[0];

    for (const a of j.alerts) {
      const dropped =
        !!best && best.price <= a.target && (a.notifiedPrice === undefined || best.price < a.notifiedPrice);
      if (dropped) {
        await sendMail(
          a.email,
          `Bajó: ${a.query} a ${formatArs(best.price)} en ${STORES[best.store].name}`,
          priceMail({
            heading: `Más barato en ${STORES[best.store].name}`,
            price: formatNum(best.price),
            lines: [best.title, `Querías pagar ${formatArs(a.target)} o menos.`],
            cta: { href: best.url, label: `Ver en ${STORES[best.store].name}` },
            footer: `Los precios cambian: verificá en la tienda. <a href="${base}/api/alertas/baja?id=${a.id}&token=${a.token}">Darte de baja</a>`,
          }),
        );
        mails++;
      }
      await db.updateAlert(a.id, { checkedAt: now, ...(dropped ? { notifiedPrice: best.price } : {}) });
    }

    if (best) {
      for (const s of j.subs) {
        if (goneSubs.has(s.endpoint)) continue;
        const cur = touchedSubs.get(s.endpoint) ?? s;
        const mine = cur.follows.filter((f) => normalize(f.query) === normalize(j.query));
        const res = evaluateFollows(mine, new Map(mine.map((f) => [f.query.toLowerCase(), best.price])));
        const follows = cur.follows.map((f) => res.follows.find((x) => x.query === f.query) ?? f);
        touchedSubs.set(s.endpoint, { ...cur, follows, checkedAt: now });
        for (const n of res.notify) {
          const r = await sendPush(s, {
            title: `Bajó ${n.query}`,
            body: `${formatArs(n.price)} en ${STORES[best.store].name} (antes ${formatArs(n.before)})`,
            url: `/?q=${encodeURIComponent(n.query)}`,
            tag: `baja:${normalize(n.query)}`,
          });
          if (r === "ok") pushes++;
          if (r === "gone") goneSubs.add(s.endpoint);
        }
      }
    }
    checked++;
  }

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const j = next;
      await check(j).catch((e) => console.error(`[cron] ${j.query}:`, e instanceof Error ? e.message : e));
      if (Date.now() - t0 > BUDGET_MS) return;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  for (const s of touchedSubs.values()) if (!goneSubs.has(s.endpoint)) await db.savePush(s);
  for (const e of goneSubs) await db.deletePush(e);
  const checks = await health;

  return Response.json({
    queries: jobs.size,
    popular: popular.length,
    checked,
    pending: queue.length,
    alerts: alerts.length,
    sent: mails,
    pushes,
    devices: subs.length,
    stores: Object.fromEntries(checks.map((c) => [c.store, c.status])),
    storage: db.kind,
  });
}
