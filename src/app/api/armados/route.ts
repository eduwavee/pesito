import { getDb } from "@/lib/db";

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
  const key = String(body.key ?? "").slice(0, 1200);
  const total = Math.round(Number(body.total));
  const parts = Math.round(Number(body.parts));
  if (!/^[a-z]+=/.test(key) || !(total > 0) || !(parts > 0 && parts <= 8)) {
    return Response.json({ error: "Armado inválido" }, { status: 400 });
  }
  await getDb().recordBuild({ key, total, parts });
  return Response.json({ ok: true }, { status: 201 });
}
