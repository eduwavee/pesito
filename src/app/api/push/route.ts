import { getDb, type PushFollow } from "@/lib/db";
import { pushConfigured, sendPush, validEndpoint } from "@/lib/push";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_FOLLOWS = 30;

interface Body {
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  follows?: { query?: unknown; basePrice?: unknown }[];
  /** manda una notificación de prueba */
  test?: boolean;
}

const KEY = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

/**
 * Alta / actualización de un dispositivo con notificaciones: guarda la suscripción
 * y la lista de búsquedas que sigue (la lista vive en el navegador; acá va una copia
 * para que el cron sepa qué revisar).
 */
export async function POST(req: Request) {
  if (!pushConfigured()) return Response.json({ error: "Las notificaciones no están configuradas" }, { status: 503 });
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  if (!validEndpoint(endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || !KEY.test(p256dh) || !KEY.test(auth)) {
    return Response.json({ error: "Suscripción inválida" }, { status: 400 });
  }
  if (!rateLimit(`push:${clientIp(req)}`, 30, 3600e3)) {
    return Response.json({ error: "Demasiados cambios seguidos. Probá en un rato." }, { status: 429 });
  }

  const db = getDb();
  if (db.kind === "memory") {
    return Response.json({ error: "Este servidor no tiene base de datos: no podemos guardar avisos." }, { status: 503 });
  }

  const prev = (await db.pushSubs()).find((s) => s.endpoint === endpoint);
  const seen = new Set<string>();
  const follows: PushFollow[] = [];
  for (const f of body.follows ?? []) {
    const query = String(f?.query ?? "").trim().slice(0, 80);
    const key = query.toLowerCase();
    if (query.length < 2 || seen.has(key)) continue;
    seen.add(key);
    const base = Math.round(Number(f.basePrice));
    const old = prev?.follows.find((x) => x.query.toLowerCase() === key);
    follows.push({
      query,
      // si ya lo seguía, conservamos la referencia y el último aviso
      basePrice: old?.basePrice ?? (Number.isFinite(base) && base > 0 ? base : undefined),
      notifiedPrice: old?.notifiedPrice,
    });
    if (follows.length >= MAX_FOLLOWS) break;
  }

  const sub = { endpoint, p256dh, auth, createdAt: prev?.createdAt ?? new Date().toISOString(), follows, checkedAt: prev?.checkedAt };
  await db.savePush(sub);

  if (body.test) {
    const r = await sendPush(sub, {
      title: "Así te vamos a avisar",
      body: follows.length
        ? `Revisamos ${follows.length === 1 ? "tu búsqueda" : `tus ${follows.length} búsquedas`} todos los días.`
        : "Seguí una búsqueda y te avisamos cuando baje.",
      url: "/seguidos",
      tag: "prueba",
    });
    if (r === "gone") {
      await db.deletePush(endpoint);
      return Response.json({ error: "El navegador dio de baja las notificaciones. Activalas de nuevo." }, { status: 410 });
    }
  }
  return Response.json({ ok: true, follows: follows.length });
}

/** Baja de un dispositivo. */
export async function DELETE(req: Request) {
  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  if (!validEndpoint(body.endpoint)) return Response.json({ error: "Suscripción inválida" }, { status: 400 });
  await getDb().deletePush(body.endpoint);
  return Response.json({ ok: true });
}
