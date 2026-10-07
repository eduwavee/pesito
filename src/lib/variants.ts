import { canonical } from "./text";
import type { Product } from "./types";

/**
 * Variantes de un mismo modelo: "rtx 5060" trae 5060 y 5060 Ti, "ryzen 5 7600" trae 7600 y 7600X.
 * Son productos distintos (y de precios distintos), así que el usuario tiene que poder separarlos.
 */
const SUFFIXES = ["ti", "super", "x3d", "xtx", "xt", "gre", "x", "kf", "ks", "k", "f", "ge", "g"];
/** los que algunas tiendas escriben separados: "RTX 5060 Ti", "RX 7900 XTX" */
const SPACED = new Set(["ti", "super", "xt", "xtx", "x3d", "gre"]);

/** Palabras que solo indican la variante: no sirven para distinguir la línea del fabricante. */
export const VARIANT_WORDS = new Set(SUFFIXES);

const LABELS: Record<string, string> = { ti: "Ti", super: "Super" };
const fmt = (suffix: string) => LABELS[suffix] ?? suffix.toUpperCase();

/** El número de modelo de la búsqueda ("5060", "7600", "12400") y el sufijo pedido, si lo hay. */
export function modelOf(query: string): { digits: string; suffix: string } | undefined {
  const words = canonical(query).split(" ");
  for (let i = words.length - 1; i >= 0; i--) {
    const m = /^[a-z]*?(\d{3,5})([a-z0-9]*)$/.exec(words[i]);
    if (!m) continue;
    const [, digits, rest] = m;
    if (rest && !SUFFIXES.includes(rest)) continue; // "144hz", "650w": no es un modelo
    const next = words[i + 1];
    return { digits, suffix: rest || (next && SPACED.has(next) ? next : "") };
  }
  return undefined;
}

/** Etiqueta de la variante del producto ("5060 Ti", "7600X", "5060") o undefined si no se encuentra. */
export function variantOf(title: string, model: { digits: string }): string | undefined {
  const words = canonical(title).split(" ");
  const re = new RegExp(`^[a-z]*${model.digits}([a-z0-9]*)$`);
  for (let i = 0; i < words.length; i++) {
    const m = re.exec(words[i]);
    if (!m) continue;
    let suffix = SUFFIXES.includes(m[1]) ? m[1] : "";
    if (!suffix && !m[1] && SPACED.has(words[i + 1])) suffix = words[i + 1];
    return label(model.digits, suffix);
  }
  return undefined;
}

/** "5060 Ti" y "7900 XTX" se escriben separados; "7600X" y "7800X3D", pegados */
const label = (digits: string, suffix: string) =>
  !suffix ? digits : SPACED.has(suffix) && suffix !== "x3d" ? `${digits} ${fmt(suffix)}` : `${digits}${fmt(suffix)}`;

export interface Variant {
  label: string;
  count: number;
  minPrice: number;
}

/**
 * Variantes presentes en los resultados (de más barata a más cara) y cuál corresponde a lo que
 * se buscó. Si hay una sola variante no hay nada que separar y devuelve [].
 */
export function variantsOf(products: Product[], query: string): { variants: Variant[]; asked?: string } {
  const model = modelOf(query);
  if (!model) return { variants: [] };
  const map = new Map<string, Variant>();
  for (const p of products) {
    const v = variantOf(p.title, model);
    if (!v) continue;
    const cur = map.get(v);
    if (cur) {
      cur.count++;
      cur.minPrice = Math.min(cur.minPrice, p.price);
    } else map.set(v, { label: v, count: 1, minPrice: p.price });
  }
  if (map.size < 2) return { variants: [] };
  const variants = [...map.values()].sort((a, b) => a.minPrice - b.minPrice);
  const asked = label(model.digits, model.suffix);
  return { variants, asked: map.has(asked) ? asked : undefined };
}
