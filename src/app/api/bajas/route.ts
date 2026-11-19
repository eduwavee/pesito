import { arDay, getDb } from "@/lib/db";
import { findDrops } from "@/lib/drops";

/** GET /api/bajas → búsquedas cuyo precio más bajo bajó desde el último registro. */
export async function GET() {
  const snapshots = await getDb()
    .recentSnapshots(20)
    .catch(() => []);
  const drops = findDrops(snapshots, { today: arDay() });
  return Response.json({ drops }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
