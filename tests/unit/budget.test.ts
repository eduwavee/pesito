import { describe, expect, it } from "vitest";
import { buildTotal, decodeBuild, encodeBuild } from "@/lib/builder/build";
import { buildWarnings } from "@/lib/builder/compat";
import { limiter, optimizeBudget, spendByPart, type Fetch } from "@/lib/builder/budget";
import { fitsCategory, type PartId } from "@/lib/builder/parts";
import type { Product } from "@/lib/types";
import { isUsed } from "@/lib/text";

/** Precio de cada búsqueda en el catálogo falso (lo que no está, no existe en ninguna tienda). */
const PRICES: Record<string, number> = {
  // AM4
  "Ryzen 5 5500": 90_000,
  "Ryzen 5 5600": 120_000,
  "Ryzen 7 5700X": 190_000,
  "Ryzen 7 5700X3D": 290_000,
  "Ryzen 5 5600G": 140_000,
  "Ryzen 7 5700G": 210_000,
  A520M: 75_000,
  B550M: 110_000,
  "DDR4 8GB 3200": 25_000,
  "DDR4 16GB 3200": 45_000,
  "DDR4 32GB 3200": 85_000,
  // AM5
  "Ryzen 5 7600": 230_000,
  "Ryzen 5 9600X": 300_000,
  "Ryzen 7 7700": 330_000,
  "Ryzen 7 7800X3D": 520_000,
  "Ryzen 7 9800X3D": 650_000,
  "Ryzen 9 9900X": 560_000,
  "Ryzen 9 9950X": 820_000,
  "Ryzen 5 8600G": 260_000,
  "Ryzen 7 8700G": 360_000,
  A620M: 120_000,
  B650M: 190_000,
  "DDR5 8GB": 40_000,
  "DDR5 16GB": 70_000,
  "DDR5 32GB": 130_000,
  "DDR5 64GB": 260_000,
  // Intel
  "Core i3 12100F": 110_000,
  "Core i5 12400F": 160_000,
  "Core i5 14400F": 250_000,
  "Core i5 14600KF": 360_000,
  "Core i7 14700KF": 520_000,
  "Core i3 12100": 140_000,
  "Core i5 12400": 190_000,
  "Core i5 14400": 280_000,
  "H610M DDR5": 110_000,
  "B760M DDR5": 170_000,
  // placas
  "RX 6600": 330_000,
  "RTX 5060": 420_000,
  "RX 9060 XT": 520_000,
  "RTX 5060 Ti": 600_000,
  "RTX 5070": 850_000,
  "RX 9070 XT": 1_050_000,
  "RTX 5070 Ti": 1_250_000,
  "RTX 5080": 1_700_000,
  // resto
  "SSD 500GB NVMe": 50_000,
  "SSD 1TB NVMe": 80_000,
  "SSD 2TB NVMe": 150_000,
  "Cooler CPU": 35_000,
  "Water cooler 240": 110_000,
  Gabinete: 70_000,
  "Gabinete micro ATX": 65_000,
};

const PREFIX: Record<PartId, string> = {
  cpu: "Procesador AMD/Intel",
  mother: "Mother",
  ram: "Memoria RAM",
  gpu: "Placa de video",
  ssd: "Disco",
  psu: "",
  cooler: "",
  case: "",
};

/** Fuentes: el precio sube con los watts y la certificación. */
const psuPrice = (q: string) => {
  const w = Number(/(\d{3,4})W/.exec(q)?.[1] ?? 650);
  return 40_000 + w * 100 + (/Gold/.test(q) ? 30_000 : 0);
};

const queries: string[] = [];
const fakeFetch: Fetch = async (part, query) => {
  queries.push(query);
  const price = part === "psu" ? psuPrice(query) : PRICES[query];
  if (!price) return [];
  // el mother micro ATX dice "M" en el chipset; los procesadores, su socket por el modelo
  const title = `${PREFIX[part]} ${query}`.trim();
  const p: Product = { id: `${part}-${query}`, store: "mexx", title, price, url: "https://x", inStock: true };
  // trampas: las tiendas devuelven variantes parecidas (más baratas) que no son el modelo pedido
  const trap = TRAPS[query];
  return trap ? [p, { ...p, id: `trap-${query}`, title: `${PREFIX[part]} ${trap}`, price: 10_000 }] : [p];
};
const TRAPS: Record<string, string> = { "Ryzen 5 5600": "Ryzen 5 5600T", "RTX 5060": "RTX 5060 Ti", "Ryzen 5 5600G": "Ryzen 5 5600GE" };

const run = (budget: number, extra: Partial<Parameters<typeof optimizeBudget>[0]> = {}) =>
  optimizeBudget({ budget, use: "gaming", brand: "any", owned: {}, fetch: fakeFetch, ...extra });

describe("armado por presupuesto (optimizador)", () => {
  it("usa casi todo el presupuesto, sin pasarse, y el armado es compatible y completo", async () => {
    const r = await run(1_500_000);
    expect(r.fits).toBe(true);
    expect(r.total).toBeLessThanOrEqual(1_500_000);
    expect(r.total).toBe(buildTotal(r.build));
    // con los tiers fijos sobraban cientos de miles; ahora lo que sobra no alcanza para el próximo escalón
    expect(1_500_000 - r.total).toBeLessThan(r.more!.delta);
    expect(r.more!.extra).toBeGreaterThan(0);
    for (const id of ["cpu", "mother", "ram", "gpu", "ssd", "psu", "case"] as PartId[]) expect(r.build[id]?.pick).toBeTruthy();
    expect(buildWarnings(r.build).filter((w) => w.level === "error")).toEqual([]);
  });

  it("en gaming la plata va primero a la placa de video", async () => {
    const r = await run(1_500_000);
    const spend = spendByPart(r.build);
    expect(spend[0].part).toBe("gpu");
    expect(spend.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it("en edición sube antes el procesador y la memoria que en gaming", async () => {
    const g = await run(1_800_000);
    const e = await run(1_800_000, { use: "edicion" });
    const share = (r: typeof g, id: PartId) => spendByPart(r.build).find((s) => s.part === id)?.share ?? 0;
    expect(share(e, "cpu") + share(e, "ram")).toBeGreaterThan(share(g, "cpu") + share(g, "ram"));
  });

  it("más presupuesto nunca da un armado peor", async () => {
    const a = await run(1_000_000);
    const b = await run(2_500_000);
    expect(b.total).toBeGreaterThan(a.total);
    expect(b.build.gpu!.pick!.price).toBeGreaterThanOrEqual(a.build.gpu!.pick!.price);
  });

  it("si no alcanza, devuelve el más barato y avisa que se pasa", async () => {
    const r = await run(300_000);
    expect(r.fits).toBe(false);
    expect(r.total).toBeGreaterThan(300_000);
  });

  it("respeta la marca elegida", async () => {
    expect((await run(1_200_000, { brand: "intel" })).platform).toBe("LGA1700");
    expect(["AM4", "AM5"]).toContain((await run(1_200_000, { brand: "amd" })).platform);
  });

  it("lo que ya tenés no se compra ni suma, y la fuente igual se dimensiona", async () => {
    const r = await run(900_000, { owned: { gpu: true, case: true } });
    expect(r.build.gpu).toMatchObject({ pick: null, have: true });
    expect(r.build.case).toMatchObject({ pick: null, have: true });
    expect(r.build.psu?.pick).toBeTruthy();
    expect(buildWarnings(r.build).filter((w) => w.level === "error")).toEqual([]);
    // sin placa para comprar, la plata va al procesador
    expect(spendByPart(r.build)[0].part).toBe("cpu");
  });

  it("oficina: procesador con gráficos integrados y sin placa de video", async () => {
    const r = await run(600_000, { use: "oficina" });
    expect(r.build.gpu).toMatchObject({ pick: null });
    expect(r.build.gpu?.have).toBeFalsy();
    expect(r.build.cpu!.pick!.title).toMatch(/\d{4}G\b|i[35] 1\d{4}\b/);
    expect(buildWarnings(r.build).filter((w) => w.level === "error")).toEqual([]);
  });
});

describe("modelo exacto", () => {
  it("modelo exacto: sufijos desconocidos son otro modelo", async () => {
    const { isExactModel } = await import("@/lib/variants");
    expect(isExactModel("Micro AMD Ryzen 5 5600T - 6 Núcleos AM4", "Ryzen 5 5600")).toBe(false);
    expect(isExactModel("Procesador AMD Ryzen 5 5600 4.4GHz AM4", "Ryzen 5 5600")).toBe(true);
    expect(isExactModel("Placa de Video RTX 5060 Ti 8GB", "RTX 5060")).toBe(false);
    expect(isExactModel("Placa de Video Gigabyte RTX 5060 8GB", "RTX 5060")).toBe(true);
    expect(isExactModel("Placa Radeon RX 9060XT 16GB", "RX 9060 XT")).toBe(true);
    expect(isExactModel("Procesador AMD Ryzen 7 7800X3D AM5", "Ryzen 7 7800X3D")).toBe(true);
    expect(isExactModel("Procesador Intel Core i5 12400F", "Core i5 12400")).toBe(false);
  });

  it("no confunde 5600 con 5600T ni 5060 con 5060 Ti", async () => {
    for (const budget of [900_000, 1_200_000, 1_500_000]) {
      const r = await run(budget, { brand: "amd" });
      expect(r.build.cpu!.pick!.id).not.toMatch(/^trap/);
      expect(r.build.gpu!.pick!.id).not.toMatch(/^trap/);
    }
    const o = await run(600_000, { use: "oficina", brand: "amd" });
    expect(o.build.cpu!.pick!.id).not.toMatch(/^trap/);
  });
});

describe("piezas que ya tenés en el link", () => {
  it("se guardan con = y vuelven como tuyas", () => {
    const encoded = encodeBuild({ gpu: { query: "", pick: null, have: true }, cooler: { query: "", pick: null } });
    expect(encoded).toBe("cooler=%7E&gpu=%3D");
    expect(decodeBuild(encoded)).toEqual({ cooler: { query: "", skipped: true }, gpu: { query: "", skipped: true, have: true } });
  });
});

describe("usados", () => {
  it("detecta usados, reacondicionados, open box y outlet", () => {
    expect(isUsed("Mouse Logitech G203 Lightsync RGB Black - Usado en evento")).toBe(true);
    expect(isUsed("Placa de Video RTX 3060 Reacondicionada")).toBe(true);
    expect(isUsed("Monitor 27 Open Box")).toBe(true);
    expect(isUsed("Placa de Video MSI GeForce RTX 5060 8GB CYCLONE OC - OUTLET")).toBe(true);
    expect(isUsed("Ventilador Outlook 120mm")).toBe(false);
    expect(isUsed("Procesador AMD Ryzen 5 7600")).toBe(false);
  });

  it("el armador nunca los elige", () => {
    const p = { id: "x", store: "mexx" as const, title: "Placa de video RTX 5060 usada", price: 300_000, url: "#" };
    expect(fitsCategory("gpu", p)).toBe(false);
    expect(fitsCategory("gpu", { ...p, title: "Placa de video RTX 5060" })).toBe(true);
  });
});

describe("limitador", () => {
  it("nunca corre más de n tareas a la vez", async () => {
    const limit = limiter(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });
    await Promise.all(Array.from({ length: 7 }, task));
    expect(peak).toBe(2);
  });
});
