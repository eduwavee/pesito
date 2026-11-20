import { connection } from "next/server";
import { cached } from "@/lib/cache";
import { getDb } from "@/lib/db";
import { healthReport, runHealthCheck } from "@/lib/health";

export const maxDuration = 30;

/** Si el último chequeo tiene más que esto, el que entra a /estado dispara uno nuevo. */
const STALE_MS = 30 * 60_000;
/** y como mucho uno cada tanto por instancia, aunque entre mucha gente */
const MIN_GAP_MS = 15 * 60_000;

/** GET /api/estado → cómo anda cada tienda (último chequeo + 14 días). */
export async function GET() {
  // nunca en el build: sin esto Next la ejecuta para prerenderizarla (y consultaría tiendas sin red)
  await connection();
  const db = getDb();
  let checks = await db.storeChecks(14);
  const last = checks.at(-1);
  if (!last || Date.now() - Date.parse(last.at) > STALE_MS) {
    // cached() también evita que dos visitas a la vez disparen dos chequeos
    await cached("monitor:auto", MIN_GAP_MS, () => runHealthCheck(db)).catch((e) =>
      console.warn("[monitor]", e instanceof Error ? e.message : e),
    );
    checks = await db.storeChecks(14);
  }
  return Response.json(
    { checkedAt: checks.at(-1)?.at, stores: healthReport(checks), storage: db.kind },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
