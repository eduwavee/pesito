import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/search/[store]/route";
import type { StoreResult } from "@/lib/types";

const call = (store: string, q?: string) =>
  GET(new NextRequest(`http://localhost/api/search/${store}${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`), {
    params: Promise.resolve({ store }),
  } as Parameters<typeof GET>[1]);

describe("GET /api/search/[store] (DEMO_MODE)", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "1";
  });
  afterAll(() => {
    delete process.env.DEMO_MODE;
  });

  it("404 para una tienda que no existe", async () => {
    const res = await call("garbarino", "rtx 5060");
    expect(res.status).toBe(404);
  });

  it("400 si la búsqueda es muy corta", async () => {
    expect((await call("gezatek", "r")).status).toBe(400);
    expect((await call("gezatek")).status).toBe(400);
  });

  it("devuelve productos marcados como demo y con cache pública", async () => {
    const res = await call("gezatek", "rtx 5060");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=600");
    const body = (await res.json()) as StoreResult;
    expect(body).toMatchObject({ store: "gezatek", status: "ok", demo: true });
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.products.every((p) => p.store === "gezatek" && p.price > 0)).toBe(true);
  });

  it("los precios demo son estables para la misma búsqueda", async () => {
    const a = (await (await call("mexx", "ryzen 5 7600")).json()) as StoreResult;
    const b = (await (await call("mexx", "Ryzen 5 7600")).json()) as StoreResult;
    expect(a.products.map((p) => p.price)).toEqual(b.products.map((p) => p.price));
  });
});

describe("tiendas que bloquean", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("un desafío de Cloudflare da un error claro, sin cache en la CDN, y no se reintenta enseguida", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("<title>Just a moment...</title>", { status: 403, headers: { "cf-mitigated": "challenge" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("rockethard", "rtx 5060");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as StoreResult;
    expect(body).toMatchObject({ status: "error", blocked: true });
    expect(body.message).toMatch(/Cloudflare/);

    const again = (await (await call("rockethard", "otra cosa")).json()) as StoreResult;
    expect(again).toMatchObject({ status: "error", blocked: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("memorias de notebook en la búsqueda", () => {
  afterEach(() => vi.unstubAllGlobals());
  const card = (id: number, name: string, price: string) =>
    `<div class="product-card" data-id="${id}" data-nombre="${name}"><div class="product-card__name"><a href="/${id}-x">x</a></div><span class="itembig-current-price">${price}</span></div>`;
  const html = card(1, "Memoria ram Sodimm Lexar 16gb 5600Mhz DDR5", "$501.000") + card(2, "Memoria Ram Ddr5 16gb Kingston Fury Beast", "$627.000");

  it("las marca si no se pidieron, y no si la búsqueda dice sodimm", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })));
    const a = (await (await call("spacegamer", "ddr5 16gb")).json()) as StoreResult;
    expect(a.products.map((p) => [p.price, !!p.notebook])).toEqual([
      [501_000, true],
      [627_000, false],
    ]);
    const b = (await (await call("spacegamer", "sodimm ddr5 16gb")).json()) as StoreResult;
    expect(b.products.every((p) => !p.notebook)).toBe(true);
  });
});
