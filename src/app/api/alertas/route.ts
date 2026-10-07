import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { formatNum } from "@/lib/format";
import { priceMail, sendMail, siteUrl } from "@/lib/mail";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Crear una alerta: "avisame cuando <búsqueda> baje de $X". Sin cuenta: se da de baja con un link. */
export async function POST(req: Request) {
  let body: { email?: unknown; query?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const query = String(body.query ?? "").trim().slice(0, 80);
  const target = Math.round(Number(body.target));
  if (!EMAIL.test(email)) return Response.json({ error: "Revisá el mail" }, { status: 400 });
  if (query.length < 2) return Response.json({ error: "Falta qué producto seguir" }, { status: 400 });
  if (!Number.isFinite(target) || target < 1000) return Response.json({ error: "Poné un precio válido" }, { status: 400 });

  const db = getDb();
  const mine = (await db.activeAlerts()).filter((a) => a.email === email);
  if (mine.length >= 20) return Response.json({ error: "Ya tenés 20 alertas activas" }, { status: 429 });

  const alert = {
    id: randomUUID(),
    token: randomBytes(16).toString("hex"),
    email,
    query,
    target,
    createdAt: new Date().toISOString(),
    active: true,
  };
  await db.addAlert(alert);

  const base = siteUrl();
  const emailed = await sendMail(
    email,
    `Te avisamos si ${query} baja de $ ${formatNum(target)}`,
    priceMail({
      heading: `Listo: seguimos “${query}”`,
      price: formatNum(target),
      lines: ["Revisamos las siete tiendas todos los días y te escribimos apenas alguna lo tenga a ese precio o menos."],
      cta: { href: `${base}/?q=${encodeURIComponent(query)}`, label: "Ver precios de hoy" },
      footer: `¿No querés más avisos? <a href="${base}/api/alertas/baja?id=${alert.id}&token=${alert.token}">Darte de baja</a>`,
    }),
  );
  return Response.json({ id: alert.id, token: alert.token, emailed, storage: db.kind }, { status: 201 });
}
