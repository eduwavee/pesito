import { fileDb } from "./file";
import { pgDb } from "./pg";
import type { Db } from "./types";

export type * from "./types";

let db: Db | undefined;

/** Postgres si hay DATABASE_URL; si no, un archivo local en .data/ (o memoria). */
export function getDb(): Db {
  db ??= process.env.DATABASE_URL ? pgDb(process.env.DATABASE_URL) : fileDb();
  return db;
}

/** Día en Argentina (UTC-3), para que el "día" del historial no corte a las 21 hs. */
export const arDay = (d = new Date()) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
