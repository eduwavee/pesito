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
