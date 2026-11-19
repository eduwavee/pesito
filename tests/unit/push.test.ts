import { describe, expect, it } from "vitest";
import { evaluateFollows, validEndpoint } from "@/lib/push";

describe("push", () => {
  it("solo acepta endpoints https de servicios de push conocidos", () => {
    expect(validEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(validEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(validEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(validEndpoint("https://wns2-bl2p.notify.windows.com/w/?token=x")).toBe(true);
    expect(validEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(validEndpoint("https://evil.com/fcm.googleapis.com")).toBe(false);
    expect(validEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(validEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(validEndpoint(42)).toBe(false);
  });

  it("avisa cuando baja de la referencia y no repite si no baja más", () => {
    const best = new Map([["rtx 5060", 450_000]]);
    const first = evaluateFollows([{ query: "RTX 5060", basePrice: 500_000 }], best);
    expect(first.notify).toEqual([{ query: "RTX 5060", price: 450_000, before: 500_000 }]);
    expect(first.follows[0].notifiedPrice).toBe(450_000);

    const again = evaluateFollows(first.follows, best);
    expect(again.notify).toEqual([]);
    expect(again.changed).toBe(false);

    const lower = evaluateFollows(first.follows, new Map([["rtx 5060", 440_000]]));
    expect(lower.notify).toHaveLength(1);
  });

  it("sin precio de base, el primero que encuentra pasa a ser la base (sin avisar)", () => {
    const r = evaluateFollows([{ query: "ssd 1tb" }], new Map([["ssd 1tb", 90_000]]));
    expect(r.notify).toEqual([]);
    expect(r.follows[0].basePrice).toBe(90_000);
    expect(r.changed).toBe(true);
  });

  it("ignora bajas menores al 1%", () => {
    const r = evaluateFollows([{ query: "x", basePrice: 100_000 }], new Map([["x", 99_500]]));
    expect(r.notify).toEqual([]);
  });
});
