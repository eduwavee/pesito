import { describe, expect, it } from "vitest";
import { capacityGb, guessKind, pricePerGb, specsFor } from "@/lib/versus";
import type { Product } from "@/lib/types";

const p = (title: string, price = 100_000): Product => ({ id: title, store: "venex", title, price, url: "#" });

describe("comparar", () => {
  it("lee capacidades", () => {
    expect(capacityGb("SSD Kingston NV3 1TB NVMe")).toBe(1000);
    expect(capacityGb("SSD 480GB Sata")).toBe(480);
    expect(capacityGb("Memoria Kit 2x16GB DDR5")).toBe(32);
    expect(capacityGb("Mouse Logitech")).toBeUndefined();
  });

  it("adivina el tipo", () => {
    expect(guessKind("RTX 5060")).toBe("gpu");
    expect(guessKind("ryzen 5 7600")).toBe("cpu");
    expect(guessKind("ssd 1tb")).toBe("ssd");
    expect(guessKind("ddr5 32gb")).toBe("ram");
    expect(guessKind("monitor 27")).toBe("otro");
  });

  it("arma la tabla de datos por tipo", () => {
    expect(specsFor("gpu", p("Placa de Video RTX 5060 8GB GDDR7"))).toEqual([
      { label: "Memoria", value: "8 GB" },
      { label: "Consumo típico", value: "145 W" },
    ]);
    expect(specsFor("cpu", p("Procesador AMD Ryzen 7 7800X3D")).map((r) => r.value)).toEqual(["AM5", "Sí", "No"]);
  });

  it("precio por GB", () => {
    expect(pricePerGb(p("SSD 2TB", 200_000))).toBe(100);
  });
});
