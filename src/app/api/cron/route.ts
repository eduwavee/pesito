import { getDb, type Alert } from "@/lib/db";
import { formatArs, formatNum } from "@/lib/format";
import { priceMail, sendMail, siteUrl } from "@/lib/mail";
import { searchStore } from "@/lib/stores";
import { STORE_IDS, STORES } from "@/lib/stores/meta";

export const maxDuration = 60;
/** búsquedas a la vez (cada una consulta todas las tiendas en paralelo) */
const CONCURRENCY = 3;
/** dejamos de arrancar búsquedas nuevas pasado este tiempo, con margen antes de maxDuration */
const BUDGET_MS = 40_000;

/**
 * Una vez por día (vercel.json): vuelve a buscar lo que alguien sigue, guarda el
 * historial y manda los avisos de precio. Si no entra todo en una corrida, sigue
 * al otro día por las que hace más que no se revisan.
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
  const alerts = await db.activeAlerts();
  const byQuery = new Map<string, Alert[]>();
  for (const a of alerts) {
    const q = a.query.toLowerCase();
    byQuery.set(q, [...(byQuery.get(q) ?? []), a]);
  }
  // primero las que nunca se revisaron, después las más viejas
  const lastCheck = (list: Alert[]) => Math.min(...list.map((a) => (a.checkedAt ? Date.parse(a.checkedAt) : 0)));
  const queue = [...byQuery].sort((a, b) => lastCheck(a[1]) - lastCheck(b[1]));
  const base = siteUrl();
  let sent = 0;
  let checked = 0;

  async function check(q: string, list: Alert[]) {
    const results = await Promise.all(STORE_IDS.map((s) => searchStore(s, q)));
    const best = results.flatMap((r) => r.products).sort((a, b) => a.price - b.price)[0];
    const now = new Date().toISOString();
    for (const a of list) {
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
        sent++;
      }
      await db.updateAlert(a.id, { checkedAt: now, ...(dropped ? { notifiedPrice: best.price } : {}) });
    }
    checked++;
  }

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      await check(...next).catch((e) => console.error(`[cron] ${next![0]}:`, e instanceof Error ? e.message : e));
      if (Date.now() - t0 > BUDGET_MS) return;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return Response.json({
    queries: byQuery.size,
    checked,
    pending: queue.length,
    alerts: alerts.length,
    sent,
    storage: db.kind,
  });
}
