import { describe, expect, it } from "vitest";
import { buildTotal, decodeBuild, encodeBuild, oneStoreTotals } from "@/lib/builder/build";
import { buildWarnings, fitFor } from "@/lib/builder/compat";
import { qtyOf, type Build } from "@/lib/builder/parts";
import { cpuTier, recommendFor, shortName } from "@/lib/builder/recommend";
import type { Product, StoreId } from "@/lib/types";

let n = 0;
const p = (title: string, price = 100_000, store: StoreId = "venex"): Product => ({ id: `r-${++n}`, store, title, price, url: "#" });
const queries = (part: Parameters<typeof recommendFor>[0], build: Build) => recommendFor(part, build).map((r) => r.query);

describe("recomendaciones según el armado", () => {
  const r5 = p("Procesador AMD Ryzen 5 7600 5.1GHz AM5");
  const x3d = p("Procesador AMD Ryzen 7 7800X3D AM5");
  const am4 = p("Procesador AMD Ryzen 5 5600 AM4");
  const i5 = p("Procesador Intel Core i5-14400F");

  it("gama y nombre corto del procesador", () => {
    expect(cpuTier(r5.title)).toBe(2);
    expect(cpuTier(x3d.title)).toBe(3);
    expect(shortName(r5.title)).toBe("Ryzen 5 7600");
    expect(shortName(i5.title)).toBe("Core i5-14400F");
  });

  it("mother del socket del procesador, más completo para gama alta", () => {
    expect(queries("mother", { cpu: { query: "", pick: r5 } })).toEqual(["B650M", "A620M"]);
    expect(queries("mother", { cpu: { query: "", pick: x3d } })[0]).toBe("B650");
    expect(queries("mother", { cpu: { query: "", pick: am4 } })).toEqual(["B550M", "A520M"]);
    expect(recommendFor("mother", { cpu: { query: "", pick: r5 } })[0].reason).toBe("Socket AM5, para tu Ryzen 5 7600");
  });

  it("en LGA1700 el mother respeta la DDR de la memoria ya elegida", () => {
    const b: Build = { cpu: { query: "", pick: i5 }, ram: { query: "", pick: p("Memoria Kingston DDR4 16GB 3200") } };
    expect(queries("mother", b)[0]).toBe("B760M DDR4");
  });

  it("procesador según el mother si se eligió primero el mother", () => {
    expect(queries("cpu", { mother: { query: "", pick: p("Mother ASUS PRIME B650M-A") } })[0]).toBe("Ryzen 5 7600");
    expect(queries("cpu", {})).toEqual([]);
  });

  it("memoria: la DDR del mother, o la del socket", () => {
    expect(queries("ram", { cpu: { query: "", pick: r5 } })).toEqual(["DDR5 16GB", "DDR5 32GB"]);
    expect(queries("ram", { cpu: { query: "", pick: x3d } })[0]).toBe("DDR5 32GB");
    expect(queries("ram", { mother: { query: "", pick: p("Mother MSI B550M PRO-VDH") } })[0]).toBe("DDR4 16GB 3200");
  });

  it("placa de video equilibrada y fuente que alcance", () => {
    expect(queries("gpu", { cpu: { query: "", pick: r5 } })).toEqual(["RTX 5060", "RX 9060 XT"]);
    expect(queries("gpu", { cpu: { query: "", pick: x3d } })[0]).toBe("RTX 5070");
    const b: Build = { cpu: { query: "", pick: x3d }, gpu: { query: "", pick: p("Placa de Video RTX 5070 Ti 16GB") } };
    expect(queries("psu", b)[0]).toBe("Fuente 750W 80 Plus Gold");
    expect(queries("psu", { cpu: { query: "", pick: r5 }, gpu: { query: "", pick: p("RTX 5060 8GB") } })[0]).toBe("Fuente 550W 80 Plus Bronze");
  });

  it("gabinete según el formato del mother", () => {
    expect(queries("case", { mother: { query: "", pick: p("Mother Gigabyte B650I AORUS ULTRA") } })[0]).toBe("Gabinete ITX");
    // formato que no sabemos leer: igual sugerimos, pidiendo verificar
    expect(recommendFor("case", { mother: { query: "", pick: p("Motherboard Biostar B650MT AM5") } })[0].reason).toMatch(/Verificá/);
  });
});

describe("varias memorias", () => {
  const ram = p("Memoria Kingston Fury Beast DDR5 16GB 5600", 120_000, "venex");
  const ramCg = p("Memoria Kingston Fury Beast DDR5 16GB 5600", 110_000, "compragamer");

  it("el total multiplica el precio", () => {
    const b: Build = { ram: { query: "ddr5 16gb", pick: ram, qty: 2 }, cpu: { query: "", pick: p("Ryzen 5 7600", 300_000) } };
    expect(buildTotal(b)).toBe(540_000);
  });

  it("la cantidad queda entre 1 y 4", () => {
    expect(qtyOf({ ram: { query: "", qty: 9 } }, "ram")).toBe(4);
    expect(qtyOf({ ram: { query: "", qty: 0 } }, "ram")).toBe(1);
    expect(qtyOf({ gpu: { query: "", qty: 3 } }, "gpu")).toBe(1);
  });

  it("todo en una tienda también multiplica", () => {
    const b: Build = { ram: { query: "ddr5 16gb", pick: ram, qty: 4 } };
    const cg = oneStoreTotals({ ram: [ram, ramCg] }, b).find((s) => s.store === "compragamer");
    expect(cg?.total).toBe(440_000);
  });

  it("viaja en el link", () => {
    const b: Build = { ram: { query: "ddr5 16gb", pick: ram, qty: 2 } };
    expect(encodeBuild(b)).toContain("ramx=2");
    expect(decodeBuild(encodeBuild(b)).ram).toMatchObject({ query: "ddr5 16gb", pickId: ram.id, qty: 2 });
    expect(encodeBuild({ ram: { query: "ddr5 16gb", pick: ram, qty: 1 } })).not.toContain("ramx");
  });

  it("avisa: ITX con más de 2, dual channel con 3, ranuras en mATX con 4", () => {
    const itx = p("Mother Gigabyte B650I AORUS ULTRA");
    const matx = p("Mother ASUS PRIME B650M-A");
    const msg = (b: Build) => buildWarnings(b).map((w) => `${w.level}: ${w.message}`).join(" | ");
    expect(msg({ ram: { query: "", pick: ram, qty: 4 }, mother: { query: "", pick: itx } })).toMatch(/error: Los mother ITX/);
    expect(msg({ ram: { query: "", pick: ram, qty: 3 } })).toMatch(/dual channel/);
    expect(msg({ ram: { query: "", pick: ram, qty: 4 }, mother: { query: "", pick: matx } })).toMatch(/4 ranuras/);
    expect(msg({ ram: { query: "", pick: ram, qty: 2 }, mother: { query: "", pick: matx } })).toBe("");
    expect(fitFor("mother", itx, { ram: { query: "", pick: ram, qty: 4 } }).level).toBe("bad");
  });
});
