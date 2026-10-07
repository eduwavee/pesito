import { timingSafeEqual } from "node:crypto";
import { escapeHtml } from "./mail";

/** Compara el token del link sin filtrar cuánto coincide por el tiempo de respuesta. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Página chica en el estilo del cartel, para los links de los mails (confirmar, darse de baja).
 * `body` es HTML ya armado; `title` se escapa.
 */
export function noticePage(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>PrecioAR</title><body style="margin:0;background:#eef0ea;color:#16171a;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh">
<div style="background:#ff3d8b;padding:28px 32px;border-radius:6px;transform:rotate(-1.2deg);max-width:420px">
<p style="font-weight:700;font-size:20px;margin:0">${escapeHtml(title)}</p>
${body}
<p style="margin:18px 0 0"><a href="/" style="color:#16171a;font-weight:700">Volver a PrecioAR</a></p></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
