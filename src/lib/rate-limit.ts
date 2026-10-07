/**
 * Límite de pedidos por IP en memoria. Es por instancia (en serverless cada instancia
 * cuenta por su lado), así que frena scripts simples, no un ataque distribuido.
 */
const hits = new Map<string, number[]>();

/** true si el pedido entra; false si ya hizo `max` en la ventana. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, ts] of hits) if (ts[ts.length - 1] < now - windowMs) hits.delete(k);
  }
  return true;
}

/** IP del cliente detrás del proxy de Vercel/Render. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "desconocida"
  );
}
