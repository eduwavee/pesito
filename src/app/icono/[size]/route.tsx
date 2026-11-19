import { logoImage } from "@/lib/og/render";

const SIZES = new Set([180, 192, 512]);

/** /icono/192, /icono/512 (manifest) y /icono/180 (iPhone). */
export async function GET(_req: Request, ctx: RouteContext<"/icono/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("No existe", { status: 404 });
  const res = await logoImage(size);
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
  return res;
}
