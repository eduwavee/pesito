import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

/** Link de baja del mail. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const db = getDb();
  const alert = await db.getAlert(id);
  const ok = !!alert && alert.token === token;
  if (ok) await db.updateAlert(id, { active: false });
  const html = `<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>PrecioAR</title><body style="margin:0;background:#eef0ea;color:#16171a;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh">
<div style="background:#ff3d8b;padding:28px 32px;border-radius:6px;transform:rotate(-1.2deg);max-width:420px">
<p style="font-weight:700;font-size:20px;margin:0">${ok ? "Listo, no te escribimos más" : "Ese link ya no sirve"}</p>
<p style="margin:10px 0 0">${ok ? `Dejamos de seguir “${alert!.query.replace(/[<>&]/g, "")}”.` : "Puede que la alerta ya estuviera dada de baja."}</p>
<p style="margin:18px 0 0"><a href="/" style="color:#16171a;font-weight:700">Volver a PrecioAR</a></p></div></body></html>`;
  return new Response(html, { status: ok ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
