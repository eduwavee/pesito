import { describe, expect, it } from "vitest";
import { buildTotal, cheapestFit, decodeBuild, encodeBuild, oneStoreTotals, rankOffers } from "@/lib/builder/build";
import { buildWarnings, fitFor } from "@/lib/builder/compat";
import { fitsCategory, type Build } from "@/lib/builder/parts";
import { nextTier, startTier, TIERS } from "@/lib/builder/presets";
import {
  caseForm,
  caseMaxGpu,
  cpuHasGraphics,
  cpuIncludesCooler,
  cpuSocket,
  gpuWatts,
  gpuLength,
  memType,
  motherForm,
  motherMemType,
  motherSocket,
  psuWatts,
  recommendedPsu,
} from "@/lib/builder/specs";
import type { Product, StoreId } from "@/lib/types";

let n = 0;
const p = (title: string, price: number, store: StoreId = "venex", extra: Partial<Product> = {}): Product => ({
  id: `t-${++n}`,
  store,
  title,
  price,
  url: "#",
  ...extra,
});

describe("specs leídas del título", () => {
  it.each([
    ["Procesador AMD Ryzen 5 7600 4.0GHz AM5", "AM5"],
    ["Micro AMD Ryzen 7 5800X3D", "AM4"],
    ["Procesador AMD Ryzen 7 9800X3D", "AM5"],
    ["Procesador AMD Ryzen 5 8600G", "AM5"],
    ["Procesador Intel Core i5-14400F", "LGA1700"],
    ["Procesador Intel Core i3 10105", "LGA1200"],
    ["Procesador Intel Core Ultra 7 265K", "LGA1851"],
    ["Procesador misterioso", undefined],
  ])("socket de CPU: %s", (title, socket) => {
    expect(cpuSocket(title)).toBe(socket);
  });

  it.each([
    ["Mother Asus TUF B650M-Plus WiFi", "AM5"],
    ["Motherboard MSI B550M PRO-VDH", "AM4"],
    ["Mother Gigabyte B760M DS3H DDR4", "LGA1700"],
    ["Mother ASRock Z890 Pro", "LGA1851"],
    ["Mother sin chipset conocido", undefined],
  ])("socket de mother: %s", (title, socket) => {
    expect(motherSocket(title)).toBe(socket);
  });

  it("memoria del mother: explícita o deducida del socket", () => {
    expect(motherMemType("Mother B650M")).toBe("DDR5");
    expect(motherMemType("Mother B550M")).toBe("DDR4");
    expect(motherMemType("Mother B760M DDR4")).toBe("DDR4");
    expect(motherMemType("Mother B760M")).toBeUndefined(); // LGA1700 tiene de las dos
    expect(memType("Memoria Kingston Fury 16GB DDR5 6000")).toBe("DDR5");
  });

  it("potencias", () => {
    expect(psuWatts("Fuente Corsair CX650 650W 80 Plus Bronze")).toBe(650);
    expect(psuWatts("Fuente Thermaltake 750 W Gold")).toBe(750);
    expect(psuWatts("Fuente genérica")).toBeUndefined();
    expect(gpuWatts("Placa de video RTX 5060 Ti 16GB")).toBe(180);
    expect(gpuWatts("Placa de video RTX 5060 8GB")).toBe(145);
    expect(gpuWatts("Radeon RX 9070 XT")).toBe(304);
  });

  it("gráficos integrados", () => {
    expect(cpuHasGraphics("Ryzen 5 5600G")).toBe(true);
    expect(cpuHasGraphics("Ryzen 5 5600X")).toBe(false);
    expect(cpuHasGraphics("Ryzen 5 7600")).toBe(true);
    expect(cpuHasGraphics("Ryzen 5 7500F")).toBe(false);
    expect(cpuHasGraphics("Core i5-14400F")).toBe(false);
    expect(cpuHasGraphics("Core i5-14400")).toBe(true);
  });

  it.each([
    ["Mother Asus TUF B650M-Plus WiFi", "mATX"],
    ["Motherboard MSI B550M PRO-VDH", "mATX"],
    ["Mother Gigabyte B650 Gaming X AX", "ATX"],
    ["Mother ASRock B650I Lightning WiFi", "ITX"],
    ["Mother Asus ROG Strix X870-I Gaming", "ITX"],
    ["Mother MSI MAG X870 Tomahawk ATX", "ATX"],
    ["Mother genérico", undefined],
  ])("formato de mother: %s", (title, form) => {
    expect(motherForm(title)).toBe(form);
  });

  it("formato de gabinete y largo de placa", () => {
    expect(caseForm("Gabinete Cooler Master NR200P Mini ITX")).toBe("ITX");
    expect(caseForm("Gabinete Thermaltake S100 Micro ATX")).toBe("mATX");
    expect(caseForm("Gabinete Lian Li Lancool 216 ATX Mid Tower")).toBe("ATX");
    expect(caseForm("Gabinete Vidrio Templado 3 Fans")).toBeUndefined();
    expect(gpuLength("Placa de video RTX 5070 Gaming OC 340mm")).toBe(340);
    expect(caseMaxGpu("Gabinete NR200P soporta VGA hasta 330mm")).toBe(330);
  });

  it("cooler en la caja", () => {
    expect(cpuIncludesCooler("Procesador AMD Ryzen 5 7600 AM5")).toBe(true);
    expect(cpuIncludesCooler("Procesador AMD Ryzen 5 5600G c/ Cooler")).toBe(true);
    expect(cpuIncludesCooler("Procesador AMD Ryzen 7 7800X3D")).toBe(false);
    expect(cpuIncludesCooler("Procesador AMD Ryzen 5 7600X")).toBe(false);
    expect(cpuIncludesCooler("Procesador AMD Ryzen 9 9900X")).toBe(false);
    expect(cpuIncludesCooler("Procesador AMD Ryzen 5 9600")).toBe(false);
    expect(cpuIncludesCooler("Procesador Intel Core i5-14400F")).toBe(true);
    expect(cpuIncludesCooler("Procesador Intel Core i7-14700K")).toBe(false);
    expect(cpuIncludesCooler("Procesador Ryzen 5 5600 Tray")).toBe(false);
  });

  it("fuente recomendada crece con la placa de video", () => {
    const sinGpu = recommendedPsu("Ryzen 5 8600G");
    const conGpu = recommendedPsu("Ryzen 7 7800X3D", "RTX 5070 Ti");
    expect(sinGpu).toBe(450);
    expect(conGpu).toBeGreaterThanOrEqual(700);
    expect(conGpu % 50).toBe(0);
  });
});

describe("categorías", () => {
  it("descarta accesorios que matchean el texto", () => {
    expect(fitsCategory("ram", p("Memoria Kingston 16GB DDR5", 1))).toBe(true);
    expect(fitsCategory("ram", p("Memoria SODIMM 16GB DDR5 notebook", 1))).toBe(false);
    expect(fitsCategory("ssd", p("Disco SSD externo 1TB USB", 1))).toBe(false);
    expect(fitsCategory("case", p("Ventilador para gabinete 120mm", 1))).toBe(false);
    expect(fitsCategory("gpu", p("Placa de video RTX 5060", 1, "venex", { inStock: false }))).toBe(false);
    expect(fitsCategory("cpu", p("PC Gamer AMD Ryzen 5 5500 RX 7600 16GB + Teclado", 1))).toBe(false);
    expect(fitsCategory("ram", p("Memoria Kit 2x8GB DDR5 6000", 1))).toBe(true);
    expect(fitsCategory("case", p("Service Instalación de armado de PC o cambio de gabinete", 1))).toBe(false);
    expect(fitsCategory("case", p("Gabinete Magnum Tech MT-K835 con Fuente 500W", 1))).toBe(false);
    expect(fitsCategory("case", p("Gabinete Antec VX310 sin fuente", 1))).toBe(true);
    expect(fitsCategory("cooler", p("Cooler CPU DeepCool AK400 Black", 1))).toBe(true);
    expect(fitsCategory("cooler", p("Pasta térmica Arctic MX-4", 1))).toBe(false);
    expect(fitsCategory("cooler", p("Disipador M.2 para SSD", 1))).toBe(false);
  });

  it("descarta accesorios regalados que pasan el filtro por precio", () => {
    const real = [60_000, 63_000, 70_000, 75_000, 90_000].map((n) => p(`Gabinete ATX ${n}`, n));
    const ranked = rankOffers("case", [p("Gabinete tornillos", 2_050), ...real], {});
    expect(ranked[0].product.price).toBe(60_000);
    // con pocas ofertas no hay mediana confiable: no se descarta nada
    expect(rankOffers("case", [p("Gabinete mini", 9_000), p("Gabinete ATX", 60_000)], {})).toHaveLength(2);
  });
});

describe("compatibilidad", () => {
  const cpu = p("Procesador AMD Ryzen 5 7600", 300_000);
  const am4 = p("Mother MSI B550M", 150_000);
  const am5 = p("Mother Asus B650M", 200_000);

  it("marca el mother según el socket del procesador", () => {
    const build: Build = { cpu: { query: "ryzen 5 7600", pick: cpu } };
    expect(fitFor("mother", am5, build).level).toBe("ok");
    expect(fitFor("mother", am4, build)).toEqual({ level: "bad", reason: "Es AM4, el procesador es AM5" });
  });

  it("ordena compatibles primero aunque sean más caros", () => {
    const build: Build = { cpu: { query: "", pick: cpu } };
    const ranked = rankOffers("mother", [am4, am5, p("Cooler para mother", 1)], build);
    expect(ranked.map((r) => r.product.title)).toEqual(["Mother Asus B650M", "Mother MSI B550M"]);
    expect(cheapestFit("mother", [am4, am5], build)?.title).toBe("Mother Asus B650M");
  });

  it("avisa errores del armado completo", () => {
    const build: Build = {
      cpu: { query: "", pick: p("Ryzen 5 5600X", 1) },
      mother: { query: "", pick: am5 },
      ram: { query: "", pick: p("Memoria DDR4 16GB", 1) },
      gpu: { query: "", pick: null },
      psu: { query: "", pick: p("Fuente 450W", 1) },
    };
    const w = buildWarnings(build);
    expect(w.every((x) => x.level === "error")).toBe(true);
    expect(w.map((x) => x.parts[0])).toEqual(["cpu", "ram", "gpu"]);
  });

  it("avisa si el procesador no trae cooler y se eligió el de caja", () => {
    const build: Build = {
      cpu: { query: "", pick: p("Ryzen 7 7800X3D", 1) },
      cooler: { query: "", pick: null },
    };
    expect(buildWarnings(build).map((w) => w.parts[0])).toContain("cooler");
    const ok: Build = { cpu: { query: "", pick: p("Ryzen 5 7600", 1) }, cooler: { query: "", pick: null } };
    expect(buildWarnings(ok)).toEqual([]);
  });

  it("avisa si el mother no entra en el gabinete", () => {
    const build: Build = {
      mother: { query: "", pick: p("Mother Gigabyte B650 Gaming X AX", 1) },
      case: { query: "", pick: p("Gabinete NR200P Mini ITX", 1) },
    };
    expect(buildWarnings(build)[0]).toMatchObject({ level: "error", parts: ["case", "mother"] });
    expect(fitFor("case", p("Gabinete Lancool ATX Mid Tower", 1), build).level).toBe("ok");
  });

  it("un armado correcto no tiene errores", () => {
    const build: Build = {
      cpu: { query: "", pick: cpu },
      mother: { query: "", pick: am5 },
      ram: { query: "", pick: p("Memoria Fury DDR5 16GB", 1) },
      gpu: { query: "", pick: p("RTX 5060", 1) },
      psu: { query: "", pick: p("Fuente 650W", 1) },
    };
    expect(buildWarnings(build)).toEqual([]);
  });
});

describe("totales", () => {
  it("suma lo elegido y saltea lo vacío", () => {
    const build: Build = {
      cpu: { query: "", pick: p("Ryzen 5 7600", 300_000) },
      gpu: { query: "", pick: null },
      ram: { query: "ddr5" },
    };
    expect(buildTotal(build)).toBe(300_000);
  });

  it("todo en una tienda: ordena por completas y después por precio", () => {
    const cpuV = p("Procesador Ryzen 5 7600", 300_000, "venex");
    const cpuM = p("Procesador Ryzen 5 7600", 280_000, "mexx");
    const moV = p("Mother B650M", 200_000, "venex");
    const build: Build = { cpu: { query: "", pick: cpuM }, mother: { query: "", pick: moV } };
    const totals = oneStoreTotals({ cpu: [cpuV, cpuM], mother: [moV] }, build);
    expect(totals[0]).toEqual({ store: "venex", total: 500_000, missing: [] });
    expect(totals.find((t) => t.store === "mexx")).toEqual({ store: "mexx", total: 280_000, missing: ["mother"] });
  });
});

describe("link para compartir", () => {
  it("ida y vuelta", () => {
    const build: Build = {
      cpu: { query: "Ryzen 5 7600", pick: { ...p("Ryzen 5 7600", 1), id: "cg-123" } },
      gpu: { query: "RTX 5060", pick: null },
      ram: { query: "DDR5 16GB" },
    };
    const back = decodeBuild(encodeBuild(build));
    expect(back).toEqual({
      cpu: { query: "Ryzen 5 7600", pickId: "cg-123" },
      ram: { query: "DDR5 16GB", pickId: undefined },
      gpu: { query: "", skipped: true },
    });
  });
});

describe("presupuesto", () => {
  const tiers = TIERS.gaming;
  it("arranca por el medio", () => {
    expect(startTier(tiers)).toBe(1);
  });
  it("baja si se pasa, sube si sobra mucho, y no vuelve a uno probado", () => {
    expect(nextTier(tiers, 1, 1_200_000, 1_000_000, new Set([1]))).toBe(0);
    expect(nextTier(tiers, 1, 600_000, 1_000_000, new Set([1]))).toBe(2);
    expect(nextTier(tiers, 2, 1_100_000, 1_000_000, new Set([1, 2]))).toBeUndefined();
    expect(nextTier(tiers, 1, 900_000, 1_000_000, new Set([1]))).toBeUndefined();
  });
  it("cada nivel tiene las 7 piezas definidas", () => {
    for (const list of Object.values(TIERS))
      for (const t of list)
        expect(Object.keys(t.queries).sort()).toEqual(["case", "cooler", "cpu", "gpu", "mother", "psu", "ram", "ssd"]);
  });
});
