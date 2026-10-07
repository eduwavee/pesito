import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Alert, Db, SavedBuild, Snapshot } from "./types";

interface Data {
  snapshots: Snapshot[];
  alerts: Alert[];
  builds: SavedBuild[];
}

/**
 * Base local en un archivo JSON (desarrollo o una sola instancia).
 * Si no se puede escribir (ej. Vercel sin base), queda en memoria.
 */
export function fileDb(dir = process.env.PRECIOAR_DATA_DIR ?? join(process.cwd(), ".data")): Db {
  const path = join(dir, "precioar.json");
  let cache: Data | undefined;
  let writable = true;
  let queue = Promise.resolve();

  async function load(): Promise<Data> {
    if (cache) return cache;
    try {
      cache = JSON.parse(await readFile(path, "utf8")) as Data;
    } catch {
      cache = { snapshots: [], alerts: [], builds: [] };
    }
    return cache;
  }

  /** escrituras en fila y atómicas (archivo temporal + rename) */
  function save() {
    queue = queue.then(async () => {
      if (!writable || !cache) return;
      try {
        await mkdir(dir, { recursive: true });
        const tmp = `${path}.tmp`;
        await writeFile(tmp, JSON.stringify(cache));
        await rename(tmp, path);
      } catch {
        writable = false; // filesystem de solo lectura: seguimos en memoria
      }
    });
    return queue;
  }

  return {
    get kind() {
      return writable ? ("file" as const) : ("memory" as const);
    },
    async recordSnapshots(rows) {
      const d = await load();
      for (const r of rows) {
        const cur = d.snapshots.find((s) => s.day === r.day && s.query === r.query && s.store === r.store);
        if (!cur) d.snapshots.push(r);
        else if (r.price < cur.price) Object.assign(cur, r);
      }
      // nos quedamos con un año como mucho
      const cutoff = new Date(Date.now() - 366 * 864e5).toISOString().slice(0, 10);
      d.snapshots = d.snapshots.filter((s) => s.day >= cutoff);
      await save();
    },
    async history(query, days) {
      const d = await load();
      const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
      return d.snapshots.filter((s) => s.query === query && s.day >= from).sort((a, b) => a.day.localeCompare(b.day));
    },
    async topQueries(limit) {
      const counts = new Map<string, number>();
      for (const s of (await load()).snapshots) counts.set(s.query, (counts.get(s.query) ?? 0) + 1);
      return [...counts]
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },
    async addAlert(a) {
      (await load()).alerts.push(a);
      await save();
    },
    async activeAlerts() {
      return (await load()).alerts.filter((a) => a.active);
    },
    async updateAlert(id, patch) {
      const a = (await load()).alerts.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
      await save();
    },
    async getAlert(id) {
      return (await load()).alerts.find((x) => x.id === id);
    },
    async recordBuild(b) {
      const d = await load();
      const cur = d.builds.find((x) => x.key === b.key);
      const now = new Date().toISOString();
      if (cur) Object.assign(cur, b, { count: cur.count + 1, lastAt: now });
      else d.builds.push({ ...b, count: 1, lastAt: now });
      await save();
    },
    async popularBuilds(limit) {
      const d = await load();
      return [...d.builds].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)).slice(0, limit);
    },
  };
}
