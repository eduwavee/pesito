import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreCheck } from "@/lib/db/types";
import { healthReport, probeStore, transitions } from "@/lib/health";
import { ADAPTERS } from "@/lib/stores";
import { HttpError } from "@/lib/http";

const check = (store: StoreCheck["store"], at: string, status: StoreCheck["status"], ms = 500): StoreCheck => ({
  at,
  store,
  status,
  ms,
  count: status === "ok" ? 10 : 0,
});

describe("monitor de tiendas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resume por día: ok, parcial, caída o sin datos", () => {
    const now = new Date("2026-11-19T18:00:00Z");
    const report = healthReport(
      [
        check("mexx", "2026-11-17T16:00:00Z", "ok", 400),
        check("mexx", "2026-11-18T16:00:00Z", "ok", 600),
        check("mexx", "2026-11-18T20:00:00Z", "error"),
        check("mexx", "2026-11-19T16:00:00Z", "error"),
      ],
      3,
      now,
    );
    const mexx = report.find((r) => r.store === "mexx")!;
    expect(mexx.days).toEqual([
      { day: "2026-11-17", status: "ok" },
      { day: "2026-11-18", status: "partial" },
      { day: "2026-11-19", status: "down" },
    ]);
    expect(mexx).toMatchObject({ uptime: 50, avgMs: 500, lastOk: "2026-11-18T16:00:00Z" });
    expect(mexx.current?.status).toBe("error");
    const venex = report.find((r) => r.store === "venex")!;
    expect(venex.uptime).toBeUndefined();
    expect(venex.days.every((d) => d.status === "none")).toBe(true);
  });

  it("detecta tiendas que se rompen y que vuelven, no la primera vez", () => {
    const prev = [check("mexx", "2026-11-18T10:00:00Z", "ok"), check("venex", "2026-11-18T10:00:00Z", "error")];
    const next = [
      check("mexx", "2026-11-19T10:00:00Z", "empty"),
      check("venex", "2026-11-19T10:00:00Z", "ok"),
      check("gezatek", "2026-11-19T10:00:00Z", "error"),
    ];
    const { broke, recovered } = transitions(prev, next);
    expect(broke.map((c) => c.store)).toEqual(["mexx"]);
    expect(recovered.map((c) => c.store)).toEqual(["venex"]);
  });

  it("una prueba: ok con productos, empty sin productos, error con bloqueo (sin reintentar)", async () => {
    const product = { id: "x", store: "mexx" as const, title: "Mouse", price: 10_000, url: "https://x" };
    const spy = vi.spyOn(ADAPTERS.mexx, "search").mockResolvedValueOnce([]).mockResolvedValueOnce([product]);
    expect(await probeStore("mexx")).toMatchObject({ status: "ok", count: 1 });
    expect(spy).toHaveBeenCalledTimes(2);

    vi.spyOn(ADAPTERS.gezatek, "search").mockResolvedValue([]);
    expect(await probeStore("gezatek")).toMatchObject({ status: "empty", count: 0 });

    const blocked = vi.spyOn(ADAPTERS.venex, "search").mockRejectedValue(new HttpError(403, "HTTP 403 en venex"));
    expect(await probeStore("venex")).toMatchObject({ status: "error", blocked: true, message: "HTTP 403 en venex" });
    expect(blocked).toHaveBeenCalledTimes(1);
  });
});
