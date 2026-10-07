import { describe, expect, it } from "vitest";
import { compareCuotas, monthlyFromYearly, presentValue } from "@/lib/cuotas";

describe("cuotas sin interés", () => {
  it("sin inflación, las cuotas valen lo mismo que el total", () => {
    expect(presentValue(120_000, 12, 0)).toBe(120_000);
  });

  it("con inflación, valen menos que el total", () => {
    const pv = presentValue(120_000, 12, 0.03);
    expect(pv).toBeLessThan(120_000);
    // 10.000 × (1 − 1.03⁻¹²) / 0.03
    expect(Math.round(pv)).toBe(99_540);
  });

  it("decide contado o cuotas", () => {
    // mismo precio y 12 cuotas con 3 % mensual: conviene cuotas
    expect(compareCuotas(100_000, 100_000, 12, 0.03).best).toBe("cuotas");
    // contado con 25 % de descuento: conviene contado
    const v = compareCuotas(75_000, 100_000, 6, 0.02);
    expect(v.best).toBe("contado");
    expect(Math.round(v.cuota)).toBe(16_667);
  });

  it("convierte anual a mensual", () => {
    expect(monthlyFromYearly(0.4)).toBeCloseTo(0.0284, 3);
  });
});
