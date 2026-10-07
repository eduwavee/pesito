import { randomBytes, randomUUID } from "node:crypto";
import { getDb, type Db } from "@/lib/db";
import { formatNum } from "@/lib/format";
import { priceMail, sendMail, siteUrl } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY = 864e5;

/**
 * Crear una alerta: "avisame cuando <búsqueda> baje de $X". Sin cuenta: queda pendiente
 * hasta que confirman desde el mail (así nadie puede anotar el mail de otro) y se da de baja con un link.
 */
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

  if (!rateLimit(`alertas:${clientIp(req)}`, 5, 3600e3)) {
    return Response.json({ error: "Creaste muchas alertas seguidas. Probá en un rato." }, { status: 429 });
  }

  const db = getDb();
  // sin base persistente la alerta se perdería en el próximo reinicio: mejor no prometer nada
  if (db.kind === "memory") return unavailable();

  const mine = await db.alertsByEmail(email);
  if (mine.filter((a) => a.active).length >= 20) {
    return Response.json({ error: "Ya tenés 20 alertas activas" }, { status: 429 });
  }
  const since = Date.now() - DAY;
  if (mine.filter((a) => !a.confirmedAt && Date.parse(a.createdAt) > since).length >= 3) {
    return Response.json(
      { error: "Ya te mandamos mails para confirmar. Revisá tu casilla (y el spam)." },
      { status: 429 },
    );
  }

  const alert = {
    id: randomUUID(),
    token: randomBytes(16).toString("hex"),
    email,
    query,
    target,
    createdAt: new Date().toISOString(),
    active: false,
  };
  await db.addAlert(alert);
  // `kind` pasa a "memory" si el archivo no se pudo escribir recién
  if ((db.kind as Db["kind"]) === "memory") return unavailable();

  const base = siteUrl();
  const confirmUrl = `${base}/api/alertas/confirmar?id=${alert.id}&token=${alert.token}`;
  const emailed = await sendMail(
    email,
    `Confirmá tu alerta: ${query} a $ ${formatNum(target)}`,
    priceMail({
      heading: `¿Seguimos “${query}”?`,
      price: formatNum(target),
      lines: [
        "Confirmá y revisamos las siete tiendas todos los días: te escribimos apenas alguna lo tenga a ese precio o menos.",
      ],
      cta: { href: confirmUrl, label: "Confirmar alerta" },
      footer: "Si no la pediste vos, ignorá este mail: sin confirmar no te escribimos más.",
    }),
  );
  if (!emailed) {
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "No pudimos mandarte el mail. Probá más tarde." }, { status: 502 });
    }
    console.info(`[alertas] confirmar en local: ${confirmUrl}`);
  }
  return Response.json({ id: alert.id, emailed }, { status: 201 });
}

const unavailable = () =>
  Response.json({ error: "Las alertas no están disponibles en este servidor por ahora." }, { status: 503 });
