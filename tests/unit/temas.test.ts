import { describe, expect, it } from "vitest";
import { candidatesFor, pickAlternatives } from "@/lib/alternatives";
import { DUELOS, dueloResult } from "@/lib/duelos";
import { articleFor, compareLabel, CPU_PERF, findPerf, GPU_PERF, perfOf } from "@/lib/perf";
import { buyTiming } from "@/lib/timing";
import { forHistory } from "@/lib/stores";
import type { Product } from "@/lib/types";

const prod = (title: string, price: number): Product => ({ id: title, store: "mexx", title, price, url: "https://x" });

describe("tabla de rendimiento", () => {
  it("reconoce el modelo de una búsqueda sin confundir tipos ni variantes", () => {
    expect(findPerf("rtx 5060 8gb")?.query).toBe("RTX 5060");
    expect(findPerf("RTX 5060 Ti")?.query).toBe("RTX 5060 Ti");
    expect(findPerf("Ryzen 5 7600")?.query).toBe("Ryzen 5 7600");
    expect(findPerf("RX 7600")?.query).toBe("RX 7600");
    expect(findPerf("core i5 14400f")?.query).toBe("Core i5 14400F");
    expect(findPerf("Core i5 14400")).toBeUndefined(); // la versión con gráficos no está en la tabla
    expect(findPerf("SSD 1TB")).toBeUndefined();
  });

  it("artículo según el tipo: el procesador, la placa", () => {
    expect(articleFor("Ryzen 7 9800X3D")).toEqual({ el: "el", barato: "barato" });
    expect(articleFor("Core i5 14400F").el).toBe("el");
    expect(articleFor("RX 9070 XT")).toEqual({ el: "la", barato: "barata" });
  });

  it("las etiquetas tienen margen: diferencias chicas son 'parecido'", () => {
    expect(compareLabel(150, 145)).toBe("parecido");
    expect(compareLabel(160, 135)).toBe("más");
    expect(compareLabel(255, 160)).toBe("mucho más");
    expect(compareLabel(125, 135)).toBe("menos");
    expect(compareLabel(100, 135)).toBe("mucho menos");
  });

  it("todos los modelos de los duelos de placas y procesadores están en la tabla", () => {
    for (const d of DUELOS)
      for (const q of [d.a, d.b]) if (/rtx|rx|ryzen|core/i.test(q)) expect(perfOf(q), q).toBeTruthy();
  });
});

describe("alternativas", () => {
  const base = { model: perfOf("RTX 5060")!, price: 870_000 };

  it("propone la que rinde parecido o más por menos, y un salto que valga la pena", () => {
    const alts = pickAlternatives(base, [
      { model: perfOf("RX 9060 XT")!, product: prod("RX 9060 XT 8GB", 826_000) },
      { model: perfOf("RTX 5060 Ti")!, product: prod("RTX 5060 Ti 8GB", 918_000) },
      { model: perfOf("RTX 5070")!, product: prod("RTX 5070 12GB", 1_580_000) },
    ]);
    expect(alts.map((a) => [a.kind, a.query, a.delta, a.perf])).toEqual([
      ["ahorro", "RX 9060 XT", -44_000, "más"],
      ["salto", "RTX 5060 Ti", 48_000, "más"],
    ]);
  });

  it("no inventa: si nada conviene, no propone nada", () => {
    const alts = pickAlternatives(base, [
      { model: perfOf("RX 9060 XT")!, product: prod("RX 9060 XT", 900_000) }, // más cara y apenas mejor
      { model: perfOf("RTX 5070")!, product: prod("RTX 5070", 1_600_000) }, // salto muy caro
      { model: perfOf("RTX 5060 Ti")!, product: undefined },
    ]);
    expect(alts).toEqual([]);
  });

  it("avisa si el procesador es de otra plataforma", () => {
    const alts = pickAlternatives({ model: perfOf("Ryzen 5 7600")!, price: 385_000 }, [
      { model: perfOf("Ryzen 7 5700X3D")!, product: prod("Ryzen 7 5700X3D", 300_000) },
      // rinde 8 % menos: fuera del margen de "parecido", no se propone como ahorro
      { model: perfOf("Core i5 14400F")!, product: prod("Core i5 14400F", 250_000) },
    ]);
    expect(alts).toHaveLength(1);
    expect(alts[0]).toMatchObject({ kind: "ahorro", query: "Ryzen 7 5700X3D", platform: "AM4", perf: "parecido" });
  });

  it("los candidatos son del mismo tipo y cercanos", () => {
    const c = candidatesFor(perfOf("RTX 5060")!);
    expect(c.every((m) => m.kind === "gpu" && m.query !== "RTX 5060")).toBe(true);
    expect(c.map((m) => m.query)).toContain("RX 9060 XT");
    expect(c.map((m) => m.query)).not.toContain("RTX 5080");
    // la económica tiene que estar entre los candidatos: el 14400F rinde 8 % menos que el 7600
    expect(candidatesFor(perfOf("Ryzen 5 7600")!).map((m) => m.query)).toContain("Core i5 14400F");
  });
});

describe("alternativas: más casos", () => {
  it("si ninguna rinde parecido, propone una económica que rinde un poco menos y sale mucho menos", () => {
    const alts = pickAlternatives({ model: perfOf("Ryzen 5 7600")!, price: 384_839 }, [
      { model: perfOf("Core i5 14400F")!, product: prod("Core i5 14400F", 251_700) },
    ]);
    expect(alts).toMatchObject([{ kind: "ahorro", query: "Core i5 14400F", perf: "menos", delta: -133_139 }]);
  });

  it("una que rinde más y sale menos también vale como salto", () => {
    const alts = pickAlternatives({ model: perfOf("RTX 5070")!, price: 1_582_900 }, [
      { model: perfOf("RX 9070")!, product: prod("RX 9070", 1_280_800) },
      { model: perfOf("RX 9070 XT")!, product: prod("RX 9070 XT", 1_575_100) },
    ]);
    expect(alts.map((a) => [a.kind, a.query, a.delta])).toEqual([
      ["ahorro", "RX 9070", -302_100],
      ["salto", "RX 9070 XT", -7_800],
    ]);
  });
});

describe("¿comprar ahora o esperar?", () => {
  const days = (prices: number[]) => prices.map((price, i) => ({ day: `2026-11-${String(10 + i).padStart(2, "0")}`, price }));
  const today = "2026-11-19";

  it("sin suficientes días no opina", () => {
    expect(buyTiming(days([100, 100]), 90, today).verdict).toBe("pocos");
    expect(buyTiming(days([100, 100, 100, 100]), undefined, today).verdict).toBe("pocos");
  });

  it("buen momento si es el mínimo o está claramente debajo de lo normal", () => {
    expect(buyTiming(days([100, 98, 102, 101, 99]), 97, today)).toMatchObject({ verdict: "bueno" });
    expect(buyTiming(days([100, 90, 102, 101, 99]), 94, today)).toMatchObject({ verdict: "bueno", text: expect.stringContaining("6 %") });
  });

  it("conviene esperar si está bastante arriba; normal en el medio", () => {
    expect(buyTiming(days([100, 98, 102, 101, 99]), 110, today).verdict).toBe("esperar");
    expect(buyTiming(days([100, 98, 102, 101, 99]), 101, today).verdict).toBe("normal");
  });

  it("no cuenta el día de hoy ni lo de hace más de 30 días", () => {
    const pts = [{ day: "2026-09-01", price: 50 }, ...days([100, 100, 100, 100]), { day: today, price: 60 }];
    expect(buyTiming(pts, 100, today).verdict).toBe("bueno"); // 100 es el mínimo de la ventana
  });
});

describe("duelos", () => {
  it("compara precio por GB cuando la capacidad es distinta", () => {
    const r = dueloResult({ tema: "x", a: "SSD 1TB NVMe", b: "SSD 2TB NVMe" }, prod("SSD 1TB NVMe", 100_000), prod("SSD 2TB NVMe", 160_000));
    expect(r.perGb).toEqual([100, 80]);
    expect(r.perf).toBeUndefined();
  });

  it("dice cómo rinde B contra A en placas, sin precio por GB de la memoria de video", () => {
    const r = dueloResult({ tema: "x", a: "RTX 5070", b: "RX 9070 XT" }, prod("RTX 5070 12GB", 1), prod("RX 9070 XT 16GB", 2));
    expect(r.perf).toBe("más");
    expect(r.perGb).toBeUndefined();
  });
});

describe("historial: solo el modelo exacto en placas y procesadores", () => {
  const p = (title: string, extra: Partial<Product> = {}): Product => ({
    id: title,
    store: "rockethard",
    title,
    price: 1,
    url: "https://x",
    ...extra,
  });
  it("una 5060 Ti no cuenta como la RTX 5060 más barata", () => {
    expect(forHistory(p("Placa De Video Asus Rtx 5060ti Oc 8gb"), "rtx 5060")).toBe(false);
    expect(forHistory(p("Placa de Video Palit RTX 5060 Dual 8GB"), "rtx 5060")).toBe(true);
    expect(forHistory(p("Procesador AMD Ryzen 5 7600X"), "ryzen 5 7600")).toBe(false);
  });
  it("en el resto no exige modelo (un B650M sigue siendo un B650)", () => {
    expect(forHistory(p("Mother Asus Prime B650M-A para Ryzen"), "b650")).toBe(true);
    expect(forHistory(p("SSD Kingston NV3 1TB"), "ssd 1tb")).toBe(true);
  });
  it("usados y outlet nunca", () => {
    expect(forHistory(p("Placa RTX 5060 OUTLET", { used: true }), "rtx 5060")).toBe(false);
  });
});

describe("tabla de rendimiento: modelos populares", () => {
  it("cada búsqueda encuentra su modelo y no el vecino", () => {
    const casos: [string, string][] = [
      ["rtx 3060 12gb", "RTX 3060"],
      ["rtx 4060 ti", "RTX 4060 Ti"],
      ["rtx 4060", "RTX 4060"],
      ["rx 7600 xt", "RX 7600 XT"],
      ["rx 7600", "RX 7600"],
      ["rx 7700 xt", "RX 7700 XT"],
      ["rx 7800 xt", "RX 7800 XT"],
      ["arc b580", "Arc B580"],
      ["ryzen 5 5600g", "Ryzen 5 5600G"],
      ["ryzen 5 5600x", "Ryzen 5 5600X"],
      ["ryzen 5 5600", "Ryzen 5 5600"],
      ["ryzen 5 8600g", "Ryzen 5 8600G"],
      ["ryzen 5 7600x", "Ryzen 5 7600X"],
      ["ryzen 7 9700x", "Ryzen 7 9700X"],
      ["core i5 13400f", "Core i5 13400F"],
      ["i3 14100f", "Core i3 14100F"],
    ];
    for (const [q, m] of casos) expect(findPerf(q)?.query, q).toBe(m);
  });
  it("cada modelo de la tabla se encuentra a sí mismo", () => {
    for (const m of [...GPU_PERF, ...CPU_PERF]) expect(findPerf(m.query)?.query, m.query).toBe(m.query);
  });
});

describe("alternativas de procesadores con gráficos", () => {
  it("a un 5600G no le propone procesadores sin video", () => {
    const base = perfOf("Ryzen 5 5600G")!;
    const cands = candidatesFor(base);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((m) => m.apu)).toBe(true);
    const alt = pickAlternatives({ model: base, price: 500000 }, [
      { model: perfOf("Core i3 14100F")!, product: prod("Intel Core i3 14100F", 170000) },
      { model: perfOf("Ryzen 5 8500G")!, product: prod("AMD Ryzen 5 8500G", 300000) },
    ]);
    expect(alt.map((a) => a.query)).toEqual(["Ryzen 5 8500G"]);
  });
});
