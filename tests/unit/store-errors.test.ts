import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorLabel } from "@/lib/store-errors";
import type { StoreId, StoreResult } from "@/lib/types";

// el historial no tiene que escribir en disco durante estos tests
vi.mock("@/lib/db", () => ({
  arDay: () => "2026-01-01",
  getDb: () => ({ recordSnapshots: async () => {} }),
}));

/** Cada test arranca sin cache ni tiendas marcadas como bloqueadas. */
async function search(store: StoreId, q: string): Promise<StoreResult> {
  const { searchStore } = await import("@/lib/stores");
  return searchStore(store, q);
}

const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });

/** Página de listado de Frávega con la misma forma que la real (JSON de Next + estado de Apollo). */
function fravegaPage(codes: number[], total = codes.length) {
  const results = codes.map((code) => ({
    code: String(code),
    item: { title: `Mouse Gamer Modelo ${code}`, slug: `mouse-gamer-modelo-${code}`, images: ["a.jpg"], brand: { name: "Targa" } },
    pricing: { salePrice: 10_000 + code, listPrice: 20_000 + code },
    stock: { labels: code % 2 ? ["HOME_DELIVERY_IN_48_HOURS"] : [] },
  }));
  const state = { ROOT_QUERY: { 'items({"filters":{"keywords":"mouse gamer"}})': { total, results } } };
  const data = JSON.stringify({ props: { pageProps: { __APOLLO_STATE__: state } } });
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${data}</script></body></html>`;
}

describe("diagnóstico de errores por tienda", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("403 del firewall: bloqueo, con el código HTTP en el mensaje", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Your request was blocked.", { status: 403, headers: { server: "cloudflare" } })));
    const r = await search("fullh4rd", "mouse gamer");
    expect(r).toMatchObject({ status: "error", errorKind: "blocked", blocked: true });
    expect(r.message).toMatch(/HTTP 403.*Cloudflare/);
    expect(errorLabel(r)).toBe("bloqueó la consulta");
  });

  it("timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("The operation timed out", "TimeoutError"))));
    const r = await search("venex", "monitor");
    expect(r).toMatchObject({ status: "error", errorKind: "timeout" });
    expect(r.blocked).toBeUndefined();
    expect(r.message).toMatch(/tardó más de 12 s/);
  });

  it("error de conexión (DNS / red)", async () => {
    const err = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(err)));
    const r = await search("mexx", "monitor");
    expect(r).toMatchObject({ status: "error", errorKind: "connection" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/\[mexx\] error:connection .*ENOTFOUND/));
  });

  it("error HTTP del sitio (5xx): no cuenta como bloqueo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 503 })));
    const r = await search("gezatek", "monitor");
    expect(r).toMatchObject({ status: "error", errorKind: "http" });
    expect(r.blocked).toBeUndefined();
    expect(r.message).toMatch(/HTTP 503/);
  });

  it("respuesta vacía", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html("")));
    expect(await search("mexx", "monitor")).toMatchObject({ status: "error", errorKind: "empty-response" });
  });

  it("JSON inválido: problema de procesamiento", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html("<html>mantenimiento</html>")));
    expect(await search("compragamer", "monitor")).toMatchObject({ status: "error", errorKind: "processing" });
  });

  it("Frávega sin el JSON esperado: cambio de estructura, no 'sin resultados'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html("<html><body>rediseño</body></html>")));
    const r = await search("fravega", "mouse gamer");
    expect(r).toMatchObject({ status: "error", errorKind: "structure" });
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/\[fravega\] error:structure/));
  });

  it("Frávega con total 0: página sin resultados (no es error)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(fravegaPage([]))));
    const r = await search("fravega", "mouse gamer");
    expect(r).toMatchObject({ status: "empty", products: [] });
    expect(r.errorKind).toBeUndefined();
  });

  it("Frávega: solo rubros de gaming (o títulos 'gamer'); lo demás se descarta sin dar error", async () => {
    const { isGamingItem, readFravegaPage } = await import("@/lib/stores/fravega");
    expect(isGamingItem("informatica/gaming-pc/mouses", "Mouse Logitech G203")).toBe(true);
    expect(isGamingItem("videojuegos/accesorios", "Joystick PS5 Dualsense")).toBe(true);
    expect(isGamingItem("audio/auriculares", "Auriculares HyperX Cloud")).toBe(true);
    expect(isGamingItem("muebles/sillas/sillas-para-oficina", "Silla Gamer Ergonómica Reclinable")).toBe(true);
    expect(isGamingItem("camping-y-aire-libre/sillas-plegables", "Silla Camping Plegable")).toBe(false);
    expect(isGamingItem("salud-y-bienestar/tensiometros", "Monitor de presion Digital")).toBe(false);
    expect(isGamingItem("audio/parlantes/parlantes-portatiles", "Parlante Bluetooth")).toBe(false);
    // sin categoría informada no se descarta
    expect(isGamingItem(undefined, "Silla de comedor")).toBe(true);

    const item = (code: string, title: string, slug: string) => ({
      code,
      item: { title, slug: `p-${code}` },
      pricing: { salePrice: 50_000 },
      categorization: [[{ slug }, { slug: slug.split("/")[0] }]],
    });
    const page = (results: unknown[]) =>
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: { pageProps: { __APOLLO_STATE__: { ROOT_QUERY: { 'items({"x":1})': { total: results.length, results } } } } },
      })}</script>`;
    const mixed = readFravegaPage(
      page([
        item("1", "Silla Gamer Admiral Negro", "informatica/gaming-pc/sillas-gamer"),
        item("2", "Silla Camping Plegable Beige", "camping-y-aire-libre/sillas-plegables"),
      ]),
    );
    expect(mixed.products.map((p) => p.id)).toEqual(["fv-1"]);
    // una página con solo productos de otros rubros es "sin resultados", no un cambio de estructura
    expect(readFravegaPage(page([item("2", "Silla Camping Plegable Beige", "jardin/reposeras")])).products).toEqual([]);
  });

  it("Frávega pagina, no repite productos y sobrevive a una página caída", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page") ?? 1);
      if (page === 1) return html(fravegaPage([1, 2, 3], 40));
      if (page === 2) return html(fravegaPage([3, 4, 5], 40)); // el 3 se repite
      return new Response("", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await search("fravega", "mouse gamer");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(r.status).toBe("ok");
    expect(r.products.map((p) => p.id).sort()).toEqual(["fv-1", "fv-2", "fv-3", "fv-4", "fv-5"]);
    const p1 = r.products.find((p) => p.id === "fv-1")!;
    expect(p1).toMatchObject({ currency: "ARS", price: 10_001, listPrice: 20_001, brand: "Targa", inStock: true });
    expect(p1.url).toBe("https://www.fravega.com/p/mouse-gamer-modelo-1-1/");
    // sin modalidades de entrega informadas no afirmamos nada sobre el stock
    expect(r.products.find((p) => p.id === "fv-2")!.inStock).toBeUndefined();
  });

  it("Mercado Libre sin credenciales y con pedido de login: bloqueo con instrucción clara", async () => {
    vi.stubEnv("ML_CLIENT_ID", "");
    vi.stubEnv("ML_CLIENT_SECRET", "");
    vi.stubEnv("ML_ACCESS_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn(async () => html('<html data-x="suspicious-traffic"><a href="/gz/account-verification">x</a></html>')));
    const r = await search("mercadolibre", "monitor");
    expect(r).toMatchObject({ status: "error", errorKind: "blocked" });
    expect(r.message).toMatch(/ML_CLIENT_ID/);
  });

  it("Mercado Libre con credenciales rechazadas: lo dice, en vez de 'pidió login'", async () => {
    vi.stubEnv("ML_ACCESS_TOKEN", "");
    vi.stubEnv("ML_CLIENT_ID", "123");
    vi.stubEnv("ML_CLIENT_SECRET", "mala");
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"invalid_client"}', { status: 401 })));
    const r = await search("mercadolibre", "monitor");
    expect(r).toMatchObject({ status: "error", errorKind: "http" });
    expect(r.message).toMatch(/credenciales.*HTTP 401/);
    expect(r.blocked).toBeUndefined();
  });
});
