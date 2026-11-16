import { describe, expect, it } from "vitest";
import { ADAPTERS } from "@/lib/stores";
import type { StoreId } from "@/lib/types";

/**
 * Smoke test contra las tiendas reales (npm run test:live).
 * Si una falla, lo más probable es que haya cambiado su HTML o que bloquee la IP.
 */
describe.each(Object.keys(ADAPTERS) as StoreId[])("%s en vivo", (store) => {
  it("encuentra una RTX 5060 con precio", async () => {
    const products = await ADAPTERS[store].search("rtx 5060", 10);
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].price).toBeGreaterThan(1000);
  });
});

/** Frávega vende de todo: lo que llega al comparador tiene que ser solo de gaming. */
describe("fravega en vivo: solo gaming", () => {
  const ajeno = /camping|plegable|reposera|comedor|jard[ií]n|presi[oó]n|beb[eé]/i;
  it.each(["silla", "monitor", "mouse gamer", "teclado mecanico", "auriculares", "joystick"])(
    "'%s' no trae productos de otros rubros",
    async (q) => {
      const products = await ADAPTERS.fravega.search(q, 48);
      console.log(`${q}: ${products.length} | ${products.slice(0, 3).map((p) => `$${p.price} ${p.title.slice(0, 40)}`).join(" | ")}`);
      expect(products.length).toBeGreaterThan(0);
      expect(products.filter((p) => ajeno.test(p.title)).map((p) => p.title)).toEqual([]);
    },
  );
});
