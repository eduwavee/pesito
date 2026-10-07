import { describe, expect, it } from "vitest";
import { bestByStore, raceSteps } from "@/lib/race";
import type { Product, StoreId } from "@/lib/types";

const p = (store: StoreId, price: number, id = `${store}-${price}`): Product => ({
  id,
  store,
  title: "RTX 5060",
  price,
  url: "#",
});

describe("bestByStore", () => {
  it("se queda con el más barato de cada tienda", () => {
    const m = bestByStore([p("venex", 500), p("venex", 400), p("mexx", 450)]);
    expect(m.get("venex")?.price).toBe(400);
    expect(m.get("mexx")?.price).toBe(450);
    expect(m.has("gezatek")).toBe(false);
  });
});

describe("raceSteps", () => {
  const best = bestByStore([p("mercadolibre", 437), p("compragamer", 392), p("venex", 384), p("mexx", 416)]);

  it("tacha cada vez que llega un precio menor", () => {
    const steps = raceSteps(["mercadolibre", "mexx", "compragamer", "venex"], best);
    expect(steps.map((s) => s.price)).toEqual([437, 416, 392, 384]);
  });

  it("si gana la primera en llegar no hay tachados", () => {
    const steps = raceSteps(["venex", "mercadolibre", "compragamer"], best);
    expect(steps.map((s) => s.store)).toEqual(["venex"]);
  });

  it("ignora tiendas sin resultados u ocultas", () => {
    const steps = raceSteps(["fullh4rd", "gezatek", "mexx"], best);
    expect(steps.map((s) => s.store)).toEqual(["mexx"]);
  });
});
