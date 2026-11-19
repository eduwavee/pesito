import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFravega } from "@/lib/stores/fravega";
import { parseGezatek } from "@/lib/stores/gezatek";
import { parseMlListing } from "@/lib/stores/mercadolibre";
import { parseMexx } from "@/lib/stores/mexx";
import { parseRockethard } from "@/lib/stores/rockethard";
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

  it("Mercado Libre listado (sintético): id MLA, precio anterior y Full", () => {
    const out = parseMlListing(fixture("mercadolibre"));
    expectValid(out, "mercadolibre");
    expect(out[0]).toMatchObject({ id: "ml-MLA1500123456", price: 437100, listPrice: 489999, badge: "Full" });
    expect(out[0].url).not.toContain("#");
    expect(out[0].image).toBe("https://http2.mlstatic.com/D_1.jpg");
    expect(out[1]).toMatchObject({ id: "ml-MLA45012345", badge: undefined });
  });
});
