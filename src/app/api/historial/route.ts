import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { normalize } from "@/lib/text";

/** Precio más bajo de cada día (entre todas las tiendas) para una búsqueda. */
export async function GET(req: NextRequest) {
  const q = normalize(req.nextUrl.searchParams.get("q") ?? "");
  if (q.length < 2) return Response.json({ error: "Falta la búsqueda" }, { status: 400 });
  const days = Math.min(365, Math.max(7, Number(req.nextUrl.searchParams.get("dias")) || 90));
  const db = getDb();
  const rows = await db.history(q, days);
  const byDay = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = byDay.get(r.day);
    if (!cur || r.price < cur.price) byDay.set(r.day, r);
  }
  const points = [...byDay.values()].map(({ day, price, store, title, url }) => ({ day, price, store, title, url }));
  return Response.json({ storage: db.kind, points }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
