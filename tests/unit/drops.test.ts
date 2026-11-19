import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/lib/db/types";
import { findDrops } from "@/lib/drops";

const snap = (day: string, query: string, store: Snapshot["store"], price: number): Snapshot => ({
  day,
  query,
  store,
  price,
  title: `${query} en ${store}`,
  url: `https://ejemplo/${store}`,
});

describe("bajas de precio", () => {
  const today = "2026-11-19";

  it("compara el mínimo entre tiendas de hoy contra el último día anterior con datos", () => {
    const drops = findDrops(
      [
        snap("2026-11-15", "rtx 5060", "mexx", 500_000),
        snap("2026-11-15", "rtx 5060", "gezatek", 480_000),
        snap("2026-11-19", "rtx 5060", "mexx", 470_000),
        snap("2026-11-19", "rtx 5060", "gezatek", 432_000),
      ],
      { today },
    );
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ query: "rtx 5060", price: 432_000, store: "gezatek", prevPrice: 480_000, prevDay: "2026-11-15", pct: 10, lowest: true });
  });

  it("ignora subas, bajas chiquitas, datos viejos y búsquedas con un solo día", () => {
    const drops = findDrops(
      [
        snap("2026-11-18", "sube", "mexx", 100_000),
        snap("2026-11-19", "sube", "mexx", 110_000),
        snap("2026-11-18", "poquito", "mexx", 100_000),
        snap("2026-11-19", "poquito", "mexx", 99_000),
        snap("2026-11-10", "vieja", "mexx", 100_000),
        snap("2026-11-12", "vieja", "mexx", 80_000),
        snap("2026-11-19", "un dia", "mexx", 80_000),
      ],
      { today },
    );
    expect(drops).toEqual([]);
  });

  it("descarta bajas absurdas (otro producto que matcheó) y tiendas que ya no comparamos", () => {
    const drops = findDrops(
      [
        snap("2026-11-18", "ssd 1tb", "mexx", 100_000),
        snap("2026-11-19", "ssd 1tb", "mexx", 9_000),
        snap("2026-11-18", "ryzen 5 7600", "mexx", 300_000),
        snap("2026-11-19", "ryzen 5 7600", "fullh4rd" as Snapshot["store"], 200_000),
      ],
      { today },
    );
    expect(drops).toEqual([]);
  });

  it("marca si no es el mínimo del período y ordena por porcentaje", () => {
    const drops = findDrops(
      [
        snap("2026-11-10", "a", "mexx", 90_000),
        snap("2026-11-17", "a", "mexx", 110_000),
        snap("2026-11-19", "a", "mexx", 100_000),
        snap("2026-11-18", "b", "rockethard", 100_000),
        snap("2026-11-19", "b", "rockethard", 80_000),
      ],
      { today },
    );
    expect(drops.map((d) => [d.query, d.pct, d.lowest])).toEqual([
      ["b", 20, true],
      ["a", 9, false],
    ]);
  });
});
