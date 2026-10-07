import { describe, expect, it } from "vitest";
import { formatArs, formatNum, pctOff } from "@/lib/format";
import { priceMail } from "@/lib/mail";

// Intl usa espacio duro entre "$" y el número
const plain = (s: string) => s.replace(/\s/g, " ");

describe("format", () => {
  it("formatea pesos argentinos sin decimales", () => {
    expect(plain(formatArs(384500))).toBe("$ 384.500");
    expect(plain(formatArs(1919219.6))).toBe("$ 1.919.220");
  });
  it("formatNum no lleva signo", () => {
    expect(formatNum(384500)).toBe("384.500");
  });
  it("pctOff solo cuando el de lista es mayor", () => {
    expect(pctOff(89, 100)).toBe(11);
    expect(pctOff(100, 100)).toBe(0);
    expect(pctOff(100)).toBe(0);
  });
});

describe("mails", () => {
  it("escapa el link del producto (viene del HTML de la tienda)", () => {
    const html = priceMail({ heading: "h", price: "1", lines: [], cta: { href: 'https://t.com/a"onclick="x', label: "ver" }, footer: "" });
    expect(html).toContain('href="https://t.com/a&quot;onclick=&quot;x"');
  });
});
