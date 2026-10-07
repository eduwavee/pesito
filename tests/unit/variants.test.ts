import { describe, expect, it } from "vitest";
import { modelOf, variantOf, variantsOf } from "@/lib/variants";
import type { Product } from "@/lib/types";

const p = (title: string, price: number): Product => ({ id: title, store: "venex", title, price, url: "#" });

describe("modelOf", () => {
  it("encuentra el número de modelo y el sufijo pedido", () => {
    expect(modelOf("rtx 5060")).toEqual({ digits: "5060", suffix: "" });
    expect(modelOf("RTX 5060 Ti")).toEqual({ digits: "5060", suffix: "ti" });
    expect(modelOf("ryzen 5 7600x")).toEqual({ digits: "7600", suffix: "x" });
    expect(modelOf("i5 12400F")).toEqual({ digits: "12400", suffix: "f" });
  });
  it("ignora medidas que no son modelos", () => {
    expect(modelOf("monitor 27 144hz")).toBeUndefined();
    expect(modelOf("fuente 650w")).toBeUndefined();
    expect(modelOf("ssd 1tb")).toBeUndefined();
  });
});

describe("variantOf", () => {
  const m = { digits: "5060" };
  it("lee la variante pegada o separada", () => {
    expect(variantOf("Placa de Video MSI RTX 5060 8GB", m)).toBe("5060");
    expect(variantOf("Placa de Video MSI RTX 5060 Ti 16GB", m)).toBe("5060 Ti");
    expect(variantOf("Asus RTX5060TI Dual", m)).toBe("5060 Ti");
    expect(variantOf("Procesador AMD Ryzen 5 7600X AM5", { digits: "7600" })).toBe("7600X");
    expect(variantOf("Ryzen 7 7800X3D", { digits: "7800" })).toBe("7800X3D");
  });
});

describe("variantsOf", () => {
  it("separa 5060 de 5060 Ti y marca la pedida", () => {
    const r = variantsOf(
      [p("RTX 5060 Ti 16GB", 900), p("RTX 5060 8GB", 700), p("RTX 5060 8GB OC", 750)],
      "rtx 5060",
    );
    expect(r.variants.map((v) => [v.label, v.count, v.minPrice])).toEqual([
      ["5060", 2, 700],
      ["5060 Ti", 1, 900],
    ]);
    expect(r.asked).toBe("5060");
  });
  it("si hay una sola variante no ofrece separar", () => {
    expect(variantsOf([p("RTX 5060 8GB", 700), p("RTX 5060 OC", 710)], "rtx 5060").variants).toEqual([]);
  });
  it("si la pedida no está, asked queda vacío", () => {
    expect(variantsOf([p("Ryzen 5 7600X", 1), p("Ryzen 5 7600X3D", 2)], "ryzen 5 7600").asked).toBeUndefined();
  });
});
