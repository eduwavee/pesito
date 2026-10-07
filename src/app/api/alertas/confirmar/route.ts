import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { escapeHtml } from "@/lib/mail";
import { noticePage, sameToken } from "@/lib/notice-page";

const p = (text: string) => `<p style="margin:10px 0 0">${text}</p>`;

/**
 * Link de confirmación del mail. El GET solo muestra un botón: algunos servidores de mail
 * abren los links para revisarlos, y eso no tiene que alcanzar para activar la alerta.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const alert = await getDb().getAlert(id);
  if (!alert || !sameToken(alert.token, token)) return invalid();
  if (alert.confirmedAt) return done(alert.query);
  return noticePage(
    `¿Seguimos “${alert.query}”?`,
    `${p("Confirmá y te escribimos cuando baje del precio que elegiste.")}
<form method="post" style="margin:18px 0 0">
<input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="token" value="${escapeHtml(token)}">
<button style="background:#16171a;color:#eef0ea;border:0;padding:12px 18px;border-radius:3px;font:inherit;font-weight:700;cursor:pointer">Confirmar alerta</button>
</form>`,
  );
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => undefined);
  const id = String(form?.get("id") ?? "");
  const token = String(form?.get("token") ?? "");
  const db = getDb();
  const alert = await db.getAlert(id);
  if (!alert || !sameToken(alert.token, token)) return invalid();
  // si ya estaba confirmada no la reactivamos: puede que después se haya dado de baja
  if (!alert.confirmedAt) await db.updateAlert(id, { active: true, confirmedAt: new Date().toISOString() });
  return done(alert.query);
}

const done = (query: string) =>
  noticePage("Listo, alerta confirmada", p(`Seguimos “${escapeHtml(query)}”. Te avisamos por mail cuando baje.`));

const invalid = () => noticePage("Ese link ya no sirve", p("Puede que la alerta se haya borrado. Creala de nuevo desde Pesito."), 404);
