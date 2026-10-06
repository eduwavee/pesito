import type { NextRequest } from "next/server";
import { searchStore } from "@/lib/stores";
import { STORES } from "@/lib/stores/meta";
import type { StoreId } from "@/lib/types";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/search/[store]">) {
  const { store } = await ctx.params;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!(store in STORES)) {
    return Response.json({ error: "Tienda desconocida" }, { status: 404 });
  }
  if (q.length < 2) {
    return Response.json({ error: "Escribí al menos 2 caracteres" }, { status: 400 });
  }

  const result = await searchStore(store as StoreId, q);
  return Response.json(result, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
  });
}
