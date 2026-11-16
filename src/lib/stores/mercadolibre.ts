import * as cheerio from "cheerio";
import { cached } from "../cache";
import { getHtml, getJson, HttpError, StoreError } from "../http";
import { cleanText, parseArs } from "../text";
import type { Product, StoreAdapter } from "../types";

/**
 * Mercado Libre:
 *  - La API pública de búsqueda (/sites/MLA/search) ya NO responde sin token (403).
 *  - El listado web pide login a tráfico que parece bot.
 * Por eso:
 *  1) Si hay credenciales (ML_CLIENT_ID + ML_CLIENT_SECRET o ML_ACCESS_TOKEN) usamos la API oficial.
 *  2) Si no, intentamos el HTML del listado (funciona a veces desde IPs residenciales).
 */
const API = "https://api.mercadolibre.com";

interface MlSearchItem {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  permalink: string;
  thumbnail?: string;
  shipping?: { free_shipping?: boolean; logistic_type?: string };
  available_quantity?: number;
}

interface MlCatalogProduct {
  id: string;
  name: string;
  permalink?: string;
  pictures?: { url: string }[];
  buy_box_winner?: { price: number; original_price?: number | null } | null;
}

async function getToken(): Promise<string | undefined> {
  if (process.env.ML_ACCESS_TOKEN) return process.env.ML_ACCESS_TOKEN;
  const id = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  if (!id || !secret) return undefined;
  const { value } = await cached("ml:token", 5 * 60 * 60_000, async () => {
    let res: Response;
    try {
      res = await fetch(`${API}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new StoreError(
        timeout ? "timeout" : "connection",
        timeout ? "Mercado Libre tardó demasiado en entregar el token" : "No se pudo conectar con la API de Mercado Libre",
      );
    }
    // credenciales mal cargadas: es un problema de configuración nuestro, no un bloqueo de la tienda
    if (!res.ok) {
      throw new StoreError(
        "http",
        `Mercado Libre rechazó las credenciales de la API (HTTP ${res.status}): revisá ML_CLIENT_ID y ML_CLIENT_SECRET`,
      );
    }
    const token = ((await res.json().catch(() => ({}))) as { access_token?: string }).access_token;
    if (!token) throw new StoreError("processing", "Mercado Libre no devolvió un access_token");
    return token;
  });
  return value;
}

const hiRes = (url?: string) => url?.replace(/^http:/, "https:").replace(/-I\.(jpg|webp)$/, "-O.$1");

async function viaSearchApi(query: string, limit: number, token: string): Promise<Product[]> {
  const url = `${API}/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;
  const data = await getJson<{ results: MlSearchItem[] }>(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.results.map((r) => ({
    id: `ml-${r.id}`,
    store: "mercadolibre",
    title: r.title,
    price: Math.round(r.price),
    listPrice: r.original_price && r.original_price > r.price ? Math.round(r.original_price) : undefined,
    url: r.permalink,
    image: hiRes(r.thumbnail),
    inStock: (r.available_quantity ?? 1) > 0,
    badge: r.shipping?.logistic_type === "fulfillment" ? "Full" : undefined,
    freeShipping: r.shipping?.free_shipping ?? undefined,
  }));
}

/** Plan B con token: catálogo de productos + ganador de la buy box. */
async function viaCatalogApi(query: string, limit: number, token: string): Promise<Product[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const list = await getJson<{ results: { id: string }[] }>(
    `${API}/products/search?status=active&site_id=MLA&q=${encodeURIComponent(query)}&limit=${limit}`,
    { headers },
  );
  const details = await Promise.allSettled(
    list.results.map((r) => getJson<MlCatalogProduct>(`${API}/products/${r.id}`, { headers })),
  );
  return details.flatMap((d) => {
    if (d.status !== "fulfilled" || !d.value.buy_box_winner) return [];
    const p = d.value;
    const bb = p.buy_box_winner!;
    return [
      {
        id: `ml-${p.id}`,
        store: "mercadolibre" as const,
        title: p.name,
        price: Math.round(bb.price),
        listPrice: bb.original_price && bb.original_price > bb.price ? Math.round(bb.original_price) : undefined,
        url: p.permalink ?? `https://www.mercadolibre.com.ar/p/${p.id}`,
        image: p.pictures?.[0]?.url,
      },
    ];
  });
}

export function parseMlListing(html: string): Product[] {
  const $ = cheerio.load(html);
  const out: Product[] = [];
  const seen = new Set<string>();
  $(".poly-card").each((_, el) => {
    const card = $(el);
    const a = card.find("a.poly-component__title, .poly-component__title a").first();
    const href = a.attr("href");
    const title = cleanText(a.text());
    const price = parseArs(card.find(".poly-price__current .andes-money-amount__fraction").first().text());
    const prev = parseArs(card.find("s .andes-money-amount__fraction, .andes-money-amount--previous .andes-money-amount__fraction").first().text());
    const img = card.find("img").first();
    if (!href || !title || !price) return;
    const id = /(MLA-?\d+)/.exec(href)?.[1]?.replace("-", "") ?? href;
    // el mismo aviso puede salir dos veces (patrocinado + orgánico)
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id: `ml-${id}`,
      store: "mercadolibre",
      title,
      price,
      listPrice: prev && prev > price ? prev : undefined,
      url: href.split("#")[0],
      image: img.attr("data-src") ?? img.attr("src"),
      badge: card.find("[aria-label*='FULL'], .poly-shipping--fulfillment").length ? "Full" : undefined,
      freeShipping: /env[ií]o gratis|llega gratis/i.test(card.text()) || undefined,
    });
  });
  return out;
}

async function viaHtml(query: string, limit: number): Promise<Product[]> {
  const slug = query.trim().toLowerCase().replace(/\s+/g, "-");
  const html = await getHtml(`https://listado.mercadolibre.com.ar/${encodeURIComponent(slug).replace(/%2D/g, "-")}`);
  if (/account-verification|ingresa a\s*tu cuenta/i.test(html)) {
    throw new HttpError(
      403,
      "Mercado Libre exige iniciar sesión para ver el listado (verificación anti-bot). Solo se puede consultar con su API oficial: configurá ML_CLIENT_ID y ML_CLIENT_SECRET",
      "redirigió a /gz/account-verification",
    );
  }
  return parseMlListing(html).slice(0, limit);
}

export const mercadolibre: StoreAdapter = {
  id: "mercadolibre",
  async search(query, limit) {
    // si hay credenciales cargadas y fallan, lo decimos: caer al HTML daría un "pidió login" engañoso
    const token = await getToken();
    if (token) {
      try {
        return await viaSearchApi(query, limit, token);
      } catch (e) {
        if (!(e instanceof HttpError) || (e.status !== 403 && e.status !== 401)) throw e;
        return await viaCatalogApi(query, limit, token);
      }
    }
    return viaHtml(query, limit);
  },
};
