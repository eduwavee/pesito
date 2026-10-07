import { canonicalBuildKey } from "@/lib/builder/build";
import { PARTS } from "@/lib/builder/parts";
import { getDb } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Armados populares (los que la gente comparte o completa). */
export async function GET() {
  const builds = await getDb().popularBuilds(6);
  return Response.json({ builds }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}

/** Suma un armado al ranking. Solo la query string de /armar y su total. */
export async function POST(req: Request) {
  let body: { key?: unknown; total?: unknown; parts?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const key = canonicalBuildKey(String(body.key ?? "").slice(0, 1200));
  const total = Math.round(Number(body.total));
  const parts = Math.round(Number(body.parts));
  // una PC completa en pesos: menos de $50.000 o más de $200 millones no es un armado real
  if (!key || !(total >= 50_000 && total <= 200_000_000) || !(parts > 0 && parts <= PARTS.length)) {
    return Response.json({ error: "Armado inválido" }, { status: 400 });
  }
  const ip = clientIp(req);
  // el mismo armado cuenta una vez por persona por día, y nadie suma decenas por hora
  if (!rateLimit(`armados:${ip}`, 10, 3600e3) || !rateLimit(`armados:${ip}:${key}`, 1, 864e5)) {
    return Response.json({ ok: true, counted: false });
  }
  await getDb().recordBuild({ key, total, parts });
  return Response.json({ ok: true }, { status: 201 });
}
