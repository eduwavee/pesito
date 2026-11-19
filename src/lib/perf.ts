import { isExactModel } from "./variants";
import { guessKind } from "./versus";

/**
 * Rendimiento relativo aproximado de placas de video y procesadores (escala propia: solo sirve
 * para comparar modelos entre sí, no son FPS ni benchmarks). Lo usan el armado por presupuesto,
 * las alternativas ("rinde parecido por menos") y los duelos.
 */
export interface PerfModel {
  /** la búsqueda que identifica al modelo */
  query: string;
  kind: "gpu" | "cpu";
  /** juegos */
  gaming: number;
  /** edición / trabajo con muchos núcleos (solo procesadores) */
  edicion?: number;
  socket?: "AM4" | "AM5" | "LGA1700";
}

export const GPU_PERF: PerfModel[] = [
  { query: "RTX 3050", kind: "gpu", gaming: 70 },
  { query: "RX 6600", kind: "gpu", gaming: 100 },
  { query: "RX 7600", kind: "gpu", gaming: 118 },
  { query: "RTX 4060", kind: "gpu", gaming: 125 },
  { query: "RTX 5060", kind: "gpu", gaming: 135 },
  { query: "RX 9060 XT", kind: "gpu", gaming: 150 },
  { query: "RTX 5060 Ti", kind: "gpu", gaming: 160 },
  { query: "RX 9070", kind: "gpu", gaming: 200 },
  { query: "RTX 5070", kind: "gpu", gaming: 205 },
  { query: "RX 9070 XT", kind: "gpu", gaming: 240 },
  { query: "RTX 5070 Ti", kind: "gpu", gaming: 255 },
  { query: "RTX 5080", kind: "gpu", gaming: 300 },
];

export const CPU_PERF: PerfModel[] = [
  { query: "Ryzen 5 5500", kind: "cpu", gaming: 70, edicion: 60, socket: "AM4" },
  { query: "Ryzen 5 5600", kind: "cpu", gaming: 78, edicion: 66, socket: "AM4" },
  { query: "Ryzen 7 5700X", kind: "cpu", gaming: 82, edicion: 85, socket: "AM4" },
  { query: "Ryzen 7 5700X3D", kind: "cpu", gaming: 98, edicion: 82, socket: "AM4" },
  { query: "Ryzen 5 7600", kind: "cpu", gaming: 100, edicion: 85, socket: "AM5" },
  { query: "Ryzen 5 9600X", kind: "cpu", gaming: 106, edicion: 90, socket: "AM5" },
  { query: "Ryzen 7 7700", kind: "cpu", gaming: 108, edicion: 115, socket: "AM5" },
  { query: "Ryzen 7 7800X3D", kind: "cpu", gaming: 128, edicion: 112, socket: "AM5" },
  { query: "Ryzen 7 9800X3D", kind: "cpu", gaming: 140, edicion: 125, socket: "AM5" },
  { query: "Ryzen 9 9900X", kind: "cpu", gaming: 115, edicion: 160, socket: "AM5" },
  { query: "Ryzen 9 9950X", kind: "cpu", gaming: 120, edicion: 200, socket: "AM5" },
  { query: "Core i3 12100F", kind: "cpu", gaming: 62, edicion: 45, socket: "LGA1700" },
  { query: "Core i5 12400F", kind: "cpu", gaming: 80, edicion: 70, socket: "LGA1700" },
  { query: "Core i5 14400F", kind: "cpu", gaming: 92, edicion: 90, socket: "LGA1700" },
  { query: "Core i5 14600KF", kind: "cpu", gaming: 105, edicion: 115, socket: "LGA1700" },
  { query: "Core i7 14700KF", kind: "cpu", gaming: 115, edicion: 150, socket: "LGA1700" },
];

const ALL = [...GPU_PERF, ...CPU_PERF];

/** Puntaje de un modelo de la tabla (por su búsqueda exacta). */
export function perfOf(query: string): PerfModel | undefined {
  return ALL.find((m) => m.query.toLowerCase() === query.trim().toLowerCase());
}

/**
 * El modelo de la tabla que corresponde a lo que alguien buscó ("rtx 5060 8gb" → RTX 5060).
 * Tiene que coincidir el tipo: "RX 7600" (placa) y "Ryzen 5 7600" (procesador) comparten número.
 */
export function findPerf(query: string): PerfModel | undefined {
  const kind = guessKind(query);
  if (kind !== "gpu" && kind !== "cpu") return undefined;
  return ALL.find((m) => m.kind === kind && isExactModel(query, m.query) && sameFamily(query, m.query));
}

/** "Core i5 12400F" no es un "Ryzen …", ni una "RTX" una "RX". */
function sameFamily(query: string, model: string) {
  const fam = (s: string) => /\b(rtx|rx|ryzen|core|i[3579]|arc)\b/i.exec(s)?.[1]?.toLowerCase().replace(/^i\d$/, "core");
  const a = fam(query);
  return !a || a === fam(model);
}

/** "el Ryzen 5 7600" / "la RTX 5060": los procesadores son masculinos, las placas femeninas. */
export function articleFor(query: string): { el: "el" | "la"; barato: "barato" | "barata" } {
  const kind = perfOf(query)?.kind ?? findPerf(query)?.kind;
  return kind === "cpu" ? { el: "el", barato: "barato" } : { el: "la", barato: "barata" };
}

/** "rinde parecido", "rinde más"… según la diferencia de puntaje (con margen: son estimaciones). */
export function compareLabel(a: number, b: number): "mucho más" | "más" | "parecido" | "menos" | "mucho menos" {
  const r = a / b;
  if (r >= 1.25) return "mucho más";
  if (r >= 1.08) return "más";
  if (r > 0.93) return "parecido";
  if (r > 0.8) return "menos";
  return "mucho menos";
}
