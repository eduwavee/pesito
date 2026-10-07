import { describe, expect, it } from "vitest";
import { buildVocabulary, completions, didYouMean, editDistance } from "@/lib/suggest";

describe("completions", () => {
  it("completa por comienzo de palabra, populares primero", () => {
    const out = completions("rtx 50", [{ query: "rtx 5070 ti", count: 9 }]);
    expect(out[0]).toBe("RTX 5070 Ti");
    expect(out).toContain("RTX 5060");
    expect(out.every((s) => /rtx 50/i.test(s))).toBe(true);
  });
  it("acepta el modelo pegado", () => {
    expect(completions("rtx50", [])).toContain("RTX 5060");
  });
  it("no repite la misma búsqueda escrita distinto", () => {
    const out = completions("ssd", [{ query: "ssd 1tb", count: 5 }, { query: "ssd 1 tb", count: 3 }]);
    expect(out.filter((s) => /1 ?tb$/i.test(s))).toEqual(["ssd 1tb"]);
  });
  it("no sugiere lo mismo que ya está escrito", () => {
    expect(completions("rtx 5060", [])).not.toContain("RTX 5060");
  });
});

describe("didYouMean", () => {
  const vocab = buildVocabulary(["Placa de Video RTX 5060", "Procesador AMD Ryzen 5 7600", "Mouse Logitech G502", "Nvidia GeForce"]);
  it("corrige errores de tipeo comunes", () => {
    expect(didYouMean("rxt 5060", vocab)).toBe("rtx 5060");
    expect(didYouMean("ryzne 5 7600", vocab)).toBe("ryzen 5 7600");
    expect(didYouMean("mouse logitec", vocab)).toBe("mouse logitech");
    expect(didYouMean("nvidea", vocab)).toBe("nvidia");
  });
  it("no toca lo que está bien ni los números", () => {
    expect(didYouMean("rtx 5060", vocab)).toBeUndefined();
    expect(didYouMean("rtx 5070", vocab)).toBeUndefined();
  });
  it("editDistance cuenta transposiciones como 1", () => {
    expect(editDistance("rxt", "rtx")).toBe(1);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
  });
});
