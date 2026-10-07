import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fileDb } from "@/lib/db/file";

describe("base local (archivo JSON)", () => {
  const dir = mkdtempSync(join(tmpdir(), "precioar-"));
  const db = fileDb(dir);
  const today = new Date().toISOString().slice(0, 10);

  it("guarda el mínimo del día por tienda y no lo pisa con uno más caro", async () => {
    const row = { day: today, query: "rtx 5060", store: "venex" as const, price: 400_000, title: "RTX 5060", url: "#" };
    await db.recordSnapshots([row]);
    await db.recordSnapshots([{ ...row, price: 420_000 }]);
    await db.recordSnapshots([{ ...row, price: 390_000 }]);
    const h = await db.history("rtx 5060", 30);
    expect(h).toHaveLength(1);
    expect(h[0].price).toBe(390_000);
    // persiste en disco
    expect(JSON.parse(readFileSync(join(dir, "precioar.json"), "utf8")).snapshots).toHaveLength(1);
  });

  it("alertas: alta, baja y precio avisado", async () => {
    await db.addAlert({ id: "a1", token: "t", email: "x@y.com", query: "rtx 5060", target: 380_000, createdAt: "", active: true });
    expect(await db.activeAlerts()).toHaveLength(1);
    await db.updateAlert("a1", { notifiedPrice: 370_000 });
    expect((await db.getAlert("a1"))?.notifiedPrice).toBe(370_000);
    await db.updateAlert("a1", { active: false });
    expect(await db.activeAlerts()).toHaveLength(0);
  });

  it("armados populares: cuenta repeticiones", async () => {
    await db.recordBuild({ key: "cpu=a~1", total: 1, parts: 1 });
    await db.recordBuild({ key: "cpu=b~2", total: 2, parts: 1 });
    await db.recordBuild({ key: "cpu=b~2", total: 2, parts: 1 });
    expect((await db.popularBuilds(5)).map((b) => [b.key, b.count])).toEqual([
      ["cpu=b~2", 2],
      ["cpu=a~1", 1],
    ]);
  });
});

describe("API de alertas y cron (modo demo)", () => {
  beforeAll(() => {
    process.env.PRECIOAR_DATA_DIR = mkdtempSync(join(tmpdir(), "precioar-api-"));
    process.env.DEMO_MODE = "1";
    delete process.env.RESEND_API_KEY;
    delete process.env.CRON_SECRET;
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterAll(() => {
    delete process.env.DEMO_MODE;
    delete process.env.PRECIOAR_DATA_DIR;
  });

  const post = async (body: unknown) => {
    const { POST } = await import("@/app/api/alertas/route");
    return POST(new Request("http://x/api/alertas", { method: "POST", body: JSON.stringify(body) }));
  };

  it("valida mail, producto y precio", async () => {
    expect((await post({ email: "no-es-mail", query: "rtx 5060", target: 300000 })).status).toBe(400);
    expect((await post({ email: "a@b.com", query: "r", target: 300000 })).status).toBe(400);
    expect((await post({ email: "a@b.com", query: "rtx 5060", target: 10 })).status).toBe(400);
  });

  it("avisa cuando baja del precio y no repite el aviso", async () => {
    const res = await post({ email: "a@b.com", query: "rtx 5060", target: 99_000_000 });
    expect(res.status).toBe(201);
    const { GET } = await import("@/app/api/cron/route");
    const first = await (await GET(new Request("http://x/api/cron"))).json();
    expect(first.sent).toBe(1);
    const second = await (await GET(new Request("http://x/api/cron"))).json();
    expect(second.sent).toBe(0);
  }, 20_000);
});

describe("búsquedas populares", () => {
  it("ordena por cantidad de registros", async () => {
    const db = fileDb(mkdtempSync(join(tmpdir(), "precioar-top-")));
    const row = { day: "2026-10-01", query: "rtx 5060", store: "venex" as const, price: 1, title: "x", url: "#" };
    await db.recordSnapshots([row, { ...row, store: "mexx" }, { ...row, query: "ryzen 5 7600" }]);
    expect(await db.topQueries(5)).toEqual([
      { query: "rtx 5060", count: 2 },
      { query: "ryzen 5 7600", count: 1 },
    ]);
  });
});
