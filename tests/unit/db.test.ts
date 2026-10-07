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

  const post = async (body: unknown, ip = "10.0.0.1") => {
    const { POST } = await import("@/app/api/alertas/route");
    return POST(
      new Request("http://x/api/alertas", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } }),
    );
  };
  const cron = async (headers?: Record<string, string>) => {
    const { GET } = await import("@/app/api/cron/route");
    return GET(new Request("http://x/api/cron", { headers }));
  };
  const confirm = async (email: string) => {
    const { getDb } = await import("@/lib/db");
    const [a] = (await getDb().alertsByEmail(email)).filter((x) => !x.confirmedAt);
    const { POST } = await import("@/app/api/alertas/confirmar/route");
    const form = new FormData();
    form.set("id", a.id);
    form.set("token", a.token);
    return POST(new Request("http://x/api/alertas/confirmar", { method: "POST", body: form }));
  };

  it("valida mail, producto y precio", async () => {
    expect((await post({ email: "no-es-mail", query: "rtx 5060", target: 300000 })).status).toBe(400);
    expect((await post({ email: "a@b.com", query: "r", target: 300000 })).status).toBe(400);
    expect((await post({ email: "a@b.com", query: "rtx 5060", target: 10 })).status).toBe(400);
  });

  it("no devuelve el token: sin el mail no se puede confirmar", async () => {
    const res = await post({ email: "otro@b.com", query: "rtx 5070", target: 500_000 });
    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("token");
    const { POST } = await import("@/app/api/alertas/confirmar/route");
    const { id } = (await (await post({ email: "otro2@b.com", query: "rtx 5070", target: 500_000 })).json()) as {
      id: string;
    };
    const form = new FormData();
    form.set("id", id);
    form.set("token", "0".repeat(32));
    expect((await POST(new Request("http://x", { method: "POST", body: form }))).status).toBe(404);
  });

  it("avisa solo después de confirmar, y no repite el aviso", async () => {
    expect((await post({ email: "a@b.com", query: "rtx 5060", target: 99_000_000 })).status).toBe(201);
    expect((await (await cron()).json()).sent).toBe(0); // pendiente
    expect((await confirm("a@b.com")).status).toBe(200);
    const first = await (await cron()).json();
    expect(first).toMatchObject({ sent: 1, checked: 1, pending: 0 });
    expect((await (await cron()).json()).sent).toBe(0);
  }, 20_000);

  it("no manda más de 3 mails de confirmación por día al mismo mail", async () => {
    for (let i = 0; i < 3; i++) expect((await post({ email: "x@z.com", query: `ryzen ${i}`, target: 9_000 }, `10.1.0.${i}`)).status).toBe(201);
    const res = await post({ email: "x@z.com", query: "ryzen 9", target: 9_000 }, "10.1.0.9");
    expect(res.status).toBe(429);
  });

  it("limita las alertas por IP", async () => {
    const ip = "10.2.0.1";
    for (let i = 0; i < 5; i++) expect((await post({ email: `u${i}@z.com`, query: "ssd 1tb", target: 9_000 }, ip)).status).toBe(201);
    expect((await post({ email: "u9@z.com", query: "ssd 1tb", target: 9_000 }, ip)).status).toBe(429);
  });

  it("cron: en producción no corre sin CRON_SECRET, y con secreto lo exige", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await cron()).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await cron()).status).toBe(401);
    expect((await cron({ authorization: "Bearer s3cret" })).status).toBe(200);
    vi.unstubAllEnvs();
  });
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
