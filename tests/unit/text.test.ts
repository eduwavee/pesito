import { describe, expect, it } from "vitest";
import { absUrl, canonical, cleanText, isSecondary, matchesQuery, normalize, parseArs, storeQuery } from "@/lib/text";

describe("normalize", () => {
  it("saca acentos, mayúsculas y símbolos", () => {
    expect(normalize("Placa de Vídeo  RTX-5060 (8GB)")).toBe("placa de video rtx 5060 8gb");
  });
});

describe("matchesQuery", () => {
  it("pide todas las palabras", () => {
    expect(matchesQuery("Placa de Video MSI RTX 5060 8GB", "rtx 5060")).toBe(true);
    expect(matchesQuery("Placa de Video MSI RTX 5070 8GB", "rtx 5060")).toBe(false);
  });

  it("tolera modelos pegados o separados", () => {
    expect(matchesQuery("GeForce RTX5060 Ventus", "rtx 5060")).toBe(true);
    expect(matchesQuery("GeForce RTX 5060 Ventus", "rtx5060")).toBe(true);
  });

  it("los tokens cortos tienen que ser palabra o sufijo numérico", () => {
    expect(matchesQuery("RTX 5060 Ti 16GB", "5060 ti")).toBe(true);
    expect(matchesQuery("RTX 5060Ti 16GB", "5060 ti")).toBe(true);
    expect(matchesQuery("Fuente Titanium 850W", "850w ti")).toBe(false);
  });

  it("une número y unidad: \"16 gb\" = \"16GB\"", () => {
    expect(matchesQuery("Disco SSD Hiksemi Wave 1TB NVMe", "ssd 1 tb")).toBe(true);
    expect(matchesQuery("Memoria RAM Kingston 16 GB DDR5", "memoria 16gb ddr5")).toBe(true);
    expect(matchesQuery("Memoria RAM Kingston 16GB DDR5", "memoria 16 gb ddr5")).toBe(true);
    expect(matchesQuery("Memoria RAM Kingston 8GB DDR5", "memoria 16 gb ddr5")).toBe(false);
  });

  it("acepta plurales", () => {
    expect(matchesQuery('Monitor ASUS 27" QHD', "monitores 27")).toBe(true);
    expect(matchesQuery("Teclado Redragon Kumara", "teclados redragon")).toBe(true);
    expect(matchesQuery("Fuente Corsair 650W", "fuentes 650w")).toBe(true);
  });

  it("una búsqueda vacía no matchea nada", () => {
    expect(matchesQuery("lo que sea", "   ")).toBe(false);
  });
});

describe("canonical / storeQuery", () => {
  it("pega unidades y limpia", () => {
    expect(canonical("SSD 1 TB  M.2")).toBe("ssd 1tb m 2");
    expect(storeQuery("Memoria 16 GB DDR5")).toBe("memoria 16gb ddr5");
  });
});

describe("isSecondary", () => {
  it("detecta accesorios y productos que traen lo buscado", () => {
    expect(isSecondary("Funda para Iphone 15 Madera", "iphone 15")).toBe(true);
    expect(isSecondary("Notebook Lenovo V15 Core i7 16gb Ssd 1tb", "ssd 1tb")).toBe(true);
    expect(isSecondary("Combo Pc Amd Ryzen 5 7600 + A620", "ryzen 5 7600")).toBe(true);
    expect(isSecondary("Cargador para Notebook Lenovo 65W", "lenovo 65w")).toBe(true);
  });

  it("no descarta el producto real ni lo que el usuario pidió", () => {
    expect(isSecondary("Placa de Video MSI GeForce RTX 5060 8GB", "rtx 5060")).toBe(false);
    expect(isSecondary("Apple iPhone 15 128GB Negro", "iphone 15")).toBe(false);
    expect(isSecondary("Funda para Iphone 15 Madera", "funda iphone 15")).toBe(false);
    expect(isSecondary("Notebook Lenovo LOQ RTX 4050", "notebook rtx 4050")).toBe(false);
    expect(isSecondary("Cable HDMI 2.1 Ugreen 2m", "hdmi 2 1")).toBe(false);
  });
});

describe("parseArs", () => {
  it.each([
    ["$1.919.219", 1919219],
    ["$919.799,84", 919800],
    ["859999", 859999],
    ["$ 0", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("%s -> %s", (raw, expected) => {
    expect(parseArs(raw)).toBe(expected);
  });
});

describe("absUrl / cleanText", () => {
  it("resuelve rutas relativas y escapa espacios", () => {
    expect(absUrl("/prod/1/rtx 5060", "https://tienda.com")).toBe("https://tienda.com/prod/1/rtx%205060");
    expect(absUrl(undefined, "https://tienda.com")).toBeUndefined();
  });
  it("compacta espacios", () => {
    expect(cleanText("  RTX\n\t 5060  ")).toBe("RTX 5060");
  });
});
