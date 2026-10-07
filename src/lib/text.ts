/** minúsculas, sin acentos, solo alfanumérico separado por espacios */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const UNITS = "gb|tb|mb|hz|mhz|ghz|w|mah|mm|cm|kg|rpm|ms|v";

/** normalize + pega número y unidad: "16 GB" -> "16gb", así "16 gb" y "16GB" son lo mismo */
export function canonical(s: string): string {
  return normalize(s).replace(new RegExp(`\\b(\\d+) (${UNITS})\\b`, "g"), "$1$2");
}

/**
 * Singular aproximado en castellano: "monitores" -> "monitor", "teclados" -> "teclado".
 * Como después se compara por "contiene", quedarse corto nunca rompe un match.
 */
function singular(tok: string): string {
  if (tok.length < 5 || /\d/.test(tok)) return tok;
  if (/[rlndzj]es$/.test(tok)) return tok.slice(0, -2);
  if (/[aeiou]s$/.test(tok)) return tok.slice(0, -1);
  return tok;
}

/** Palabras de la búsqueda listas para comparar (unidades pegadas, en singular). */
export function queryTokens(query: string): string[] {
  return canonical(query).split(" ").filter(Boolean).map(singular);
}

/**
 * true si todas las palabras de la búsqueda aparecen en el título.
 * Tolera "rtx 5060" vs "rtx5060", "16 gb" vs "16GB" y plurales ("monitores" vs "Monitor").
 */
export function matchesQuery(title: string, query: string): boolean {
  const t = canonical(title);
  const compact = t.replace(/ /g, "");
  const tokens = queryTokens(query);
  if (!tokens.length) return false;
  const words = t.split(" ");
  return tokens.every((tok) =>
    // tokens cortos (ej "ti", "8") tienen que ser palabra o pegarse a una ("5060ti"),
    // así "ti" no matchea "titanium"
    tok.length <= 2
      ? words.some((w) => w === tok || (w.endsWith(tok) && /\d/.test(w)))
      : compact.includes(tok),
  );
}

/** Accesorios: "Funda para iPhone 15" no es un iPhone 15. */
const ACCESSORY = new Set(
  "funda fundas protector vidrio templado film estuche carcasa correa malla skin lamina sticker".split(" "),
);
/** Cosas que traen el producto adentro: "Notebook ... SSD 1TB" no es un SSD. */
const BUNDLE = new Set("notebook notebooks pc combo kit computadora".split(" "));
/** Solo cuentan como accesorio si dicen "para ..." / "compatible ...": "Cable HDMI" sí es lo que buscás. */
const FOR_WORDS = new Set("cable cargador adaptador soporte repuesto bateria".split(" "));

/**
 * true si el título es *otra cosa* que menciona lo buscado (una funda, una notebook que trae
 * el SSD, una PC armada con ese procesador). Se mira solo lo que está antes de la primera
 * palabra buscada y se ignora si el usuario pidió esa categoría ("funda iphone 15").
 */
export function isSecondary(title: string, query: string): boolean {
  const tokens = queryTokens(query);
  const words = canonical(title).split(" ");
  const first = words.findIndex((w) => tokens.some((tok) => w.includes(tok)));
  if (first <= 0) return false;
  const before = words.slice(0, first);
  const asked = (w: string) => tokens.some((tok) => w.startsWith(tok));
  const hasFor = before.includes("para") || before.includes("compatible");
  return before.some(
    (w) => !asked(w) && (ACCESSORY.has(w) || BUNDLE.has(w) || (hasFor && FOR_WORDS.has(w))),
  );
}

/** Qué le mandamos al buscador de la tienda: "SSD 1 TB" -> "ssd 1tb" (matchea mejor en todas). */
export function storeQuery(query: string): string {
  return canonical(query) || query.trim();
}

/** "$1.919.219" | "$919.799,84" | "859999" -> número */
export function parseArs(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  // formato AR: punto miles, coma decimales
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function absUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href.trim().replace(/ /g, "%20"), base).toString();
  } catch {
    return undefined;
  }
}

export function cleanText(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}
