/**
 * Mails con Resend (https://resend.com). Sin RESEND_API_KEY no se manda nada:
 * se loguea, así se puede probar todo en local.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail] (sin RESEND_API_KEY) para ${to}: ${subject}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.RESEND_FROM ?? "PrecioAR <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) console.warn("[mail] Resend respondió", res.status, await res.text());
  return res.ok;
}

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Mail simple en el estilo del cartel: el precio grande sobre rosa. */
export function priceMail(o: { heading: string; price: string; lines: string[]; cta: { href: string; label: string }; footer: string }) {
  return `<!doctype html><html><body style="margin:0;background:#eef0ea;font-family:Arial,Helvetica,sans-serif;color:#16171a">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="font-weight:700;font-size:18px;margin:0 0 16px">PrecioAR</p>
  <div style="background:#ff3d8b;padding:24px;border-radius:6px">
    <p style="margin:0;font-weight:700;font-size:17px">${escapeHtml(o.heading)}</p>
    <p style="margin:8px 0 0;font-weight:900;font-size:44px;line-height:1">$ ${escapeHtml(o.price)}.-</p>
    ${o.lines.map((l) => `<p style="margin:10px 0 0;font-size:15px">${escapeHtml(l)}</p>`).join("")}
    <p style="margin:20px 0 0"><a href="${escapeHtml(o.cta.href)}" style="background:#16171a;color:#eef0ea;padding:12px 18px;border-radius:3px;text-decoration:none;font-weight:700">${escapeHtml(o.cta.label)}</a></p>
  </div>
  <p style="font-size:12px;color:#50535b;margin-top:18px">${o.footer}</p>
</div></body></html>`;
}
