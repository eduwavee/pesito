import { describe, expect, it } from "vitest";
import { fingerprint, groupProducts, sameProduct } from "@/lib/group";
import type { Product, StoreId } from "@/lib/types";

const p = (store: StoreId, title: string, price: number): Product => ({ id: `${store}-${title}`, store, title, price, url: "#" });
const same = (a: string, b: string, q: string) => sameProduct(fingerprint(a, q), fingerprint(b, q));

describe("sameProduct", () => {
  const q = "rtx 5060";
  it("une el mismo modelo escrito distinto", () => {
    expect(same("Placa de Video MSI GeForce RTX 5060 8GB GDDR7 SHADOW 2X OC", "Placa De Video MSI RTX5060 Shadow 2X 8Gb", q)).toBe(true);
    expect(same("Procesador AMD Ryzen 5 7600 5.1GHz Turbo AM5 + Wraith Stealth", "Micro AMD Ryzen 5 7600 - 6 Núcleos / 12 Threads", "ryzen 5 7600")).toBe(true);
  });
  it("separa marca, línea, variante y capacidad distintas", () => {
    expect(same("MSI RTX 5060 8GB Shadow 2X", "ASUS RTX 5060 8GB Dual", q)).toBe(false);
    expect(same("MSI RTX 5060 8GB Shadow 2X", "MSI RTX 5060 8GB Ventus 2X", q)).toBe(false);
    expect(same("MSI RTX 5060 8GB Ventus 2X", "MSI RTX 5060 8GB Ventus 3X", q)).toBe(false);
    expect(same("MSI RTX 5060 8GB Shadow 2X", "MSI RTX 5060 Ti 8GB Shadow 2X", q)).toBe(false);
    expect(same("MSI RTX 5060 Ti 8GB Shadow 2X", "MSI RTX 5060 Ti 16GB Shadow 2X", q)).toBe(false);
    // casos reales que se mezclaban
    expect(same("Gigabyte RTX 5060 Ti 8GB WINDFORCE OC", "Gigabyte NVIDIA GeForce RTX 5060 Ti 8GB Eagle OC", q)).toBe(false);
    expect(same("MSI RTX 5060 TI 8GB SHADOW X2 OC PLUS", "MSI RTX 5060 Ti 8GB Ventus 2X OC Plus", q)).toBe(false);
    expect(same("SSD Adata Legend 710 1TB M.2 NVMe 2400MB/s", "Disco Solido SSD ADATA 1TB SU650SS 520MB/s", "ssd 1tb")).toBe(false);
  });

  it("memorias: velocidad, formato y color separan", () => {
    const q = "memoria 16 gb ddr5";
    expect(same("Memoria Adata DDR5 16GB 5600MHz SODIMM", "Memoria RAM ADATA 16GB DDR5 5600Mhz", q)).toBe(false);
    expect(same("Memoria Ram DDR5 16Gb 5200 Mhz Kingston Fury Beast", "Memoria RAM Kingston 16GB DDR5 5600Mhz Fury Beast", q)).toBe(false);
    expect(same("Kingston 16GB DDR5 5600Mhz Fury Beast", "Kingston 16GB DDR5 5600Mhz Fury Beast White", q)).toBe(false);
    expect(same("Memoria RAM Hiksemi 16GB DDR5 5600Mhz Hiker", "Memoria RAM Hiksemi Hiker 16GB 5600Mhz DDR5", q)).toBe(true);
  });

  it("los SSD se reconocen por el código de modelo", () => {
    expect(same("SSD Kingston NV3 1TB M.2 NVMe PCIe 4.0 6000MB/s", "Disco SSD M2 Kingston 1Tb NV3 SNV3S 6000 MB/S NVME", "ssd 1tb")).toBe(true);
    expect(same("SSD WD Green SN350 1TB M.2 NVMe", "Disco Solido Ssd M2 Pci-E 1Tb Western Digital WD SN350 Green", "ssd 1tb")).toBe(true);
  });
});

describe("groupProducts", () => {
  it("arma grupos con 2+ tiendas, la más barata primero", () => {
    const groups = groupProducts(
      [
        p("mexx", "Placa De Video GeForce RTX 5060 8Gb Msi Shadow 2X Oc", 810_000),
        p("venex", "Placa de Video MSI NVIDIA GeForce RTX 5060 8GB Shadow 2X OC", 790_000),
        p("venex", "Placa de Video MSI RTX 5060 8GB Shadow 2X OC White", 805_000),
        p("gezatek", "Placa de Video Palit RTX 5060 Dual 8GB", 700_000),
        p("fravega", "Placa De Video MSI GeForce RTX 5060 8GB GDDR7 SHADOW 2X", 900_000),
      ],
      "rtx 5060",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].offers.map((o) => [o.store, o.price])).toEqual([
      ["venex", 790_000],
      ["mexx", 810_000],
      ["fravega", 900_000],
    ]);
    expect(groups[0].spread).toBe(110_000);
  });
});
