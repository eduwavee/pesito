import postgres from "postgres";
import type { Alert, Db, SavedBuild, Snapshot } from "./types";

/** Postgres (Neon, Supabase, Vercel Postgres...). Crea las tablas la primera vez. */
export function pgDb(url: string): Db {
  const sql = postgres(url, { max: 3, idle_timeout: 20, prepare: false });
  let ready: Promise<unknown> | undefined;
  const init = () =>
    (ready ??= sql.begin(async (tx) => {
      await tx`create table if not exists snapshots (
        day date not null, query text not null, store text not null,
        price integer not null, title text not null, url text not null,
        primary key (day, query, store))`;
      await tx`create table if not exists alerts (
        id text primary key, token text not null, email text not null, query text not null,
        target integer not null, created_at timestamptz not null default now(),
        active boolean not null default true, notified_price integer)`;
      await tx`alter table alerts add column if not exists confirmed_at timestamptz,
        add column if not exists checked_at timestamptz`;
      await tx`create index if not exists alerts_email on alerts (email)`;
      await tx`create table if not exists builds (
        key text primary key, total integer not null, parts integer not null,
        count integer not null default 1, last_at timestamptz not null default now())`;
    }));

  const toAlert = (r: Record<string, unknown>): Alert => ({
    id: r.id as string,
    token: r.token as string,
    email: r.email as string,
    query: r.query as string,
    target: r.target as number,
    createdAt: new Date(r.created_at as string).toISOString(),
    active: r.active as boolean,
    notifiedPrice: (r.notified_price as number | null) ?? undefined,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at as string).toISOString() : undefined,
    checkedAt: r.checked_at ? new Date(r.checked_at as string).toISOString() : undefined,
  });

  return {
    kind: "postgres",
    async recordSnapshots(rows) {
      if (!rows.length) return;
      await init();
      for (const r of rows) {
        await sql`insert into snapshots (day, query, store, price, title, url)
          values (${r.day}, ${r.query}, ${r.store}, ${r.price}, ${r.title}, ${r.url})
          on conflict (day, query, store) do update set price = excluded.price, title = excluded.title, url = excluded.url
          where excluded.price < snapshots.price`;
      }
    },
    async history(query, days) {
      await init();
      const rows = await sql`select to_char(day, 'YYYY-MM-DD') as day, query, store, price, title, url
        from snapshots where query = ${query} and day >= current_date - ${days}::int order by day`;
      return rows as unknown as Snapshot[];
    },
    async topQueries(limit) {
      await init();
      const rows = await sql`select query, count(*)::int as count from snapshots
        where day >= current_date - 90 group by query order by count desc limit ${limit}`;
      return rows.map((r) => ({ query: r.query as string, count: r.count as number }));
    },
    async addAlert(a) {
      await init();
      await sql`insert into alerts (id, token, email, query, target, created_at, active, confirmed_at)
        values (${a.id}, ${a.token}, ${a.email}, ${a.query}, ${a.target}, ${a.createdAt}, ${a.active},
          ${a.confirmedAt ?? null})`;
    },
    async activeAlerts() {
      await init();
      return (await sql`select * from alerts where active`).map(toAlert);
    },
    async alertsByEmail(email) {
      await init();
      return (await sql`select * from alerts where email = ${email}`).map(toAlert);
    },
    async updateAlert(id, patch) {
      await init();
      if (patch.active !== undefined) await sql`update alerts set active = ${patch.active} where id = ${id}`;
      if (patch.notifiedPrice !== undefined)
        await sql`update alerts set notified_price = ${patch.notifiedPrice} where id = ${id}`;
      if (patch.confirmedAt !== undefined)
        await sql`update alerts set confirmed_at = ${patch.confirmedAt} where id = ${id}`;
      if (patch.checkedAt !== undefined) await sql`update alerts set checked_at = ${patch.checkedAt} where id = ${id}`;
    },
    async getAlert(id) {
      await init();
      const [r] = await sql`select * from alerts where id = ${id}`;
      return r ? toAlert(r) : undefined;
    },
    async recordBuild(b) {
      await init();
      await sql`insert into builds (key, total, parts) values (${b.key}, ${b.total}, ${b.parts})
        on conflict (key) do update set total = excluded.total, parts = excluded.parts,
        count = builds.count + 1, last_at = now()`;
    },
    async popularBuilds(limit) {
      await init();
      const rows = await sql`select key, total, parts, count, last_at from builds
        order by count desc, last_at desc limit ${limit}`;
      return rows.map(
        (r): SavedBuild => ({
          key: r.key,
          total: r.total,
          parts: r.parts,
          count: r.count,
          lastAt: new Date(r.last_at).toISOString(),
        }),
      );
    },
  };
}
