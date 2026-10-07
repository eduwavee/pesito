import { getDb } from "@/lib/db";
import { formatArs, formatNum } from "@/lib/format";
import { priceMail, sendMail, siteUrl } from "@/lib/mail";
import { searchStore } from "@/lib/stores";
import { STORE_IDS, STORES } from "@/lib/stores/meta";

export const maxDuration = 60;

/**
 * Una vez por día (vercel.json): vuelve a buscar lo que alguien sigue, guarda el
 * historial y manda los avisos de precio. Protegido con CRON_SECRET si está definido.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = getDb();
  const alerts = await db.activeAlerts();
  const queries = [...new Set(alerts.map((a) => a.query.toLowerCase()))];
  const base = siteUrl();
  let sent = 0;

  for (const q of queries) {
    const results = await Promise.all(STORE_IDS.map((s) => searchStore(s, q)));
    const best = results.flatMap((r) => r.products).sort((a, b) => a.price - b.price)[0];
    if (!best) continue;
    for (const a of alerts.filter((x) => x.query.toLowerCase() === q)) {
      const dropped = best.price <= a.target && (a.notifiedPrice === undefined || best.price < a.notifiedPrice);
      if (!dropped) continue;
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
      await db.updateAlert(a.id, { notifiedPrice: best.price });
      sent++;
    }
  }
  return Response.json({ queries: queries.length, alerts: alerts.length, sent, storage: db.kind });
}
