import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFravega } from "@/lib/stores/fravega";
import { parseGezatek } from "@/lib/stores/gezatek";
import { parseGoldentech, type WcProduct } from "@/lib/stores/goldentech";
import { parseMlListing } from "@/lib/stores/mercadolibre";
import { parseMexx } from "@/lib/stores/mexx";
import { parseRockethard } from "@/lib/stores/rockethard";
import { parseSpacegamer } from "@/lib/stores/spacegamer";
import type { Product } from "@/lib/types";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), "utf8");

/** Lo mínimo que tiene que cumplir cualquier producto que sale de un parser. */
function expectValid(products: Product[], store: Product["store"]) {
  expect(products.length).toBeGreaterThan(0);
  for (const p of products) {
    expect(p.store).toBe(store);
    expect(p.id).toBeTruthy();
    expect(p.title.length).toBeGreaterThan(3);
    expect(Number.isInteger(p.price) && p.price > 1000).toBe(true);
    expect(p.url).toMatch(/^https?:\/\//);
    if (p.listPrice !== undefined) expect(p.listPrice).toBeGreaterThan(p.price);
  }
  expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
}

describe("parsers con HTML guardado", () => {
  it("Gezatek (HTML real)", () => {
    const out = parseGezatek(fixture("gezatek"));
    expectValid(out, "gezatek");
    expect(out.every((p) => /5060/.test(p.title))).toBe(true);
  });

  it("Frávega (JSON de Next real)", () => {
    const out = parseFravega(fixture("fravega"));
    expectValid(out, "fravega");
    expect(out[0].url).toMatch(/^https:\/\/www\.fravega\.com\/p\/.+-\d+\/$/);
    expect(out[0].image).toMatch(/^https:\/\/images\.fravega\.com\/f300\//);
    expect(parseFravega("<html>sin datos</html>")).toEqual([]);
  });

  it("Mexx (HTML real)", () => {
    expectValid(parseMexx(fixture("mexx")), "mexx");
  });

  it("RocketHard (HTML real, plataforma qloud): precio especial y precio con Mercado Pago", () => {
    const out = parseRockethard(fixture("rockethard"));
    expectValid(out, "rockethard");
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({
      id: "rh-162167",
      title: "Mouse Logitech G203 Gaming Lightsync Black",
      brand: "LOGITECH",
      price: 30304,
      cardPrice: 35757,
      inStock: true,
      badge: "Precio especial",
      url: "https://rockethard.com.ar/perifericos/mouse/mouse-logitech-g203-gaming-lightsync-black-162167.html",
    });
    expect(out.every((p) => p.cardPrice! > p.price)).toBe(true);
    expect(parseRockethard("<html>sin datos</html>")).toEqual([]);
  });

  it("Goldentech (Store API de WooCommerce real): precio en centavos, nombre sin entidades", () => {
    const { items } = JSON.parse(readFileSync(new URL("../fixtures/goldentech.json", import.meta.url), "utf8")) as { items: WcProduct[] };
    const out = parseGoldentech(items);
    expectValid(out, "goldentech");
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ id: "gt-189682", price: 1_008_634, inStock: true });
    expect(out[0].url).toMatch(/^https:\/\/goldentechstore\.com\.ar\/producto\//);
    expect(out.every((p) => !/&#?\w+;/.test(p.title))).toBe(true);
    // entidades HTML y precio de lista
    const [x] = parseGoldentech([{ ...items[0], name: "Placa &#8211; RTX&nbsp;5060", prices: { price: "10000000", regular_price: "12000000", currency_minor_unit: 2 } }]);
    expect(x).toMatchObject({ title: "Placa – RTX 5060", price: 100_000, listPrice: 120_000 });
  });

  it("Space Gamer (HTML real): precio vigente, tachado y stock", () => {
    const out = parseSpacegamer(fixture("spacegamer"));
    expectValid(out, "spacegamer");
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ id: "sg-488946", title: "Memoria Ram Ddr5 16gb 5600mhz Kingston Fury Beast RGB Black", price: 627_000, inStock: true });
    expect(out[0].url).toBe("https://spacegamer.com.ar/488946-componentes-de-pc-kingston-memoria-ram-ddr5-16gb-5600mhz-fury-beast-rgb-bl");
    expect(out[0].image).toMatch(/^https:\/\/spacegamer\.com\.ar\/img\//);
    expect(out[3].listPrice).toBeGreaterThan(out[3].price);
    expect(parseSpacegamer("<html>sin datos</html>")).toEqual([]);
  });

  it("Mercado Libre listado (sintético): id MLA, precio anterior y Full", () => {
    const out = parseMlListing(fixture("mercadolibre"));
    expectValid(out, "mercadolibre");
    expect(out[0]).toMatchObject({ id: "ml-MLA1500123456", price: 437100, listPrice: 489999, badge: "Full" });
    expect(out[0].url).not.toContain("#");
    expect(out[0].image).toBe("https://http2.mlstatic.com/D_1.jpg");
    expect(out[1]).toMatchObject({ id: "ml-MLA45012345", badge: undefined });
  });
});
