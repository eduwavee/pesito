import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { escapeHtml } from "@/lib/mail";
import { noticePage, sameToken } from "@/lib/notice-page";

/** Link de baja del mail. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const db = getDb();
  const alert = await db.getAlert(id);
  if (!alert || !sameToken(alert.token, token)) {
    return noticePage(
      "Ese link ya no sirve",
      `<p style="margin:10px 0 0">Puede que la alerta ya estuviera dada de baja.</p>`,
      404,
    );
  }
  await db.updateAlert(id, { active: false });
  return noticePage(
    "Listo, no te escribimos más",
    `<p style="margin:10px 0 0">Dejamos de seguir “${escapeHtml(alert.query)}”.</p>`,
  );
}
