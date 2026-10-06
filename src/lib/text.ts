/** minúsculas, sin acentos, solo alfanumérico separado por espacios */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * true si todas las palabras de la búsqueda aparecen en el título.
 * Tolera "rtx 5060" vs "rtx5060" comparando también sin espacios.
 */
export function matchesQuery(title: string, query: string): boolean {
  const t = normalize(title);
  const compact = t.replace(/ /g, "");
  const tokens = normalize(query).split(" ").filter(Boolean);
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
