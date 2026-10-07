import { canonical, normalize } from "./text";

/** Búsquedas típicas: sirven de sugerencia aunque la base todavía esté vacía. */
export const CURATED = [
  "RTX 5060", "RTX 5060 Ti", "RTX 5070", "RTX 5070 Ti", "RTX 5080", "RTX 5090", "RTX 4060", "RTX 3060",
  "RX 7600", "RX 9060 XT", "RX 9070 XT", "Arc B580",
  "Ryzen 5 5600", "Ryzen 5 7600", "Ryzen 5 9600X", "Ryzen 7 5700X3D", "Ryzen 7 7800X3D", "Ryzen 7 9800X3D",
  "Ryzen 5 8600G", "Core i5 12400F", "Core i5 14400F", "Core i7 14700K", "Core Ultra 5 225",
  "SSD 1TB NVMe", "SSD 2TB NVMe", "SSD 480GB", "Memoria 16GB DDR5", "Memoria 32GB DDR5", "Memoria 16GB DDR4",
  "Mother B650", "Mother A620", "Mother B760", "Mother B550", "Fuente 650W", "Fuente 750W 80 Plus Gold",
  "Monitor 24 165Hz", "Monitor 27 144hz", "Monitor 27 2K", "Gabinete", "Cooler CPU", "Water cooler 240",
  "Mouse Logitech G502", "Mouse Logitech G203", "Teclado mecánico", "Auriculares HyperX", "Notebook gamer",
  "Silla gamer", "Webcam Logitech", "Router WiFi 6", "Joystick PS5", "iPhone 15", "Samsung Galaxy S24",
];

/**
 * Autocompletado: cada palabra escrita tiene que ser el comienzo de alguna palabra de la sugerencia
 * ("rtx 50" → "RTX 5060"). Primero las más buscadas, después las de la lista fija.
 */
export function completions(input: string, popular: { query: string; count: number }[], limit = 6): string[] {
  const typed = normalize(input).split(" ").filter(Boolean);
  if (!typed.length) return [];
  const fits = (s: string) => {
    const words = normalize(s).split(" ");
    const compact = words.join("");
    return typed.every((t) => words.some((w) => w.startsWith(t)) || compact.startsWith(typed.join("")));
  };
  // clave canónica: "ssd 1 tb" y "SSD 1TB" son la misma sugerencia
  const out = new Map<string, string>();
  const self = canonical(input);
  // las populares vienen normalizadas: si hay una versión "linda" en la lista fija, usamos esa
  const pretty = new Map(CURATED.map((c) => [canonical(c), c]));
  for (const { query } of popular) {
    const key = canonical(query);
    if (key !== self && fits(query) && !out.has(key)) out.set(key, pretty.get(key) ?? query);
  }
  for (const c of CURATED) {
    const key = canonical(c);
    if (key !== self && fits(c) && !out.has(key)) out.set(key, c);
  }
  return [...out.values()].slice(0, limit);
}

/** Vocabulario: palabra → cuántas veces aparece (en el catálogo, las sugerencias, etc). */
export function buildVocabulary(texts: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const t of texts) {
    for (const w of normalize(t).split(" ")) {
      // solo palabras: los números de modelo no se "corrigen"
      if (w.length >= 3 && !/\d/.test(w)) vocab.set(w, (vocab.get(w) ?? 0) + 1);
    }
  }
  return vocab;
}

/** Distancia de edición con transposiciones ("rxt" → "rtx" cuesta 1). Corta apenas supera `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/**
 * "¿Quisiste decir…?": corrige las palabras que no existen en el vocabulario por la más
 * parecida (y más común). Devuelve undefined si no hay nada que corregir.
 */
export function didYouMean(query: string, vocab: Map<string, number>): string | undefined {
  const words = normalize(query).split(" ").filter(Boolean);
  let changed = false;
  const fixed = words.map((w) => {
    if (w.length < 3 || /\d/.test(w) || vocab.has(w)) return w;
    const max = w.length <= 4 ? 1 : 2;
    let best: { word: string; dist: number; freq: number } | undefined;
    for (const [cand, freq] of vocab) {
      const dist = editDistance(w, cand, max);
      if (dist > max) continue;
      if (!best || dist < best.dist || (dist === best.dist && freq > best.freq)) best = { word: cand, dist, freq };
    }
    if (!best) return w;
    changed = true;
    return best.word;
  });
  return changed ? fixed.join(" ") : undefined;
}
