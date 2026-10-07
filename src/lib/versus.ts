import { cpuHasGraphics, cpuIncludesCooler, cpuSocket, gpuWatts, memType, psuWatts } from "./builder/specs";
import type { Product } from "./types";

/** Capacidad en GB leída del título ("1TB", "16GB", "2 x 8GB" → 16). */
export function capacityGb(title: string): number | undefined {
  const s = title.toUpperCase();
  const kit = /(\d)\s?X\s?(\d{1,3})\s?GB/.exec(s);
  if (kit) return Number(kit[1]) * Number(kit[2]);
  const tb = /(\d+(?:[.,]\d+)?)\s?TB\b/.exec(s);
  if (tb) return Number(tb[1].replace(",", ".")) * 1000;
  const gb = /(\d{2,4})\s?GB\b/.exec(s);
  return gb ? Number(gb[1]) : undefined;
}

export type Kind = "gpu" | "cpu" | "ssd" | "ram" | "psu" | "otro";

/** Qué tipo de producto es, para elegir qué datos comparar. */
export function guessKind(query: string, sample?: string): Kind {
  const s = `${query} ${sample ?? ""}`.toUpperCase();
  if (/\bRTX\b|\bGTX\b|\bRX ?\d|PLACA DE VIDEO|RADEON|GEFORCE|ARC B\d/.test(s)) return "gpu";
  if (/RYZEN|CORE ?I\d|CORE ULTRA|PROCESADOR/.test(s)) return "cpu";
  if (/SSD|NVME|M\.2/.test(s)) return "ssd";
  if (/DDR[45]|MEMORIA/.test(s)) return "ram";
  if (/FUENTE|\d{3,4} ?W\b/.test(s)) return "psu";
  return "otro";
}

export interface SpecRow {
  label: string;
  value: string;
}

/** Datos que se pueden leer del título del producto más barato, según el tipo. */
export function specsFor(kind: Kind, p: Product): SpecRow[] {
  const t = p.title;
  const rows: SpecRow[] = [];
  const add = (label: string, value: string | number | undefined, unit = "") =>
    value !== undefined && value !== "" && rows.push({ label, value: `${value}${unit}` });
  if (kind === "gpu") {
    add("Memoria", /(\d{1,2}) ?GB/i.exec(t)?.[1], " GB");
    add("Consumo típico", gpuWatts(t), " W");
  }
  if (kind === "cpu") {
    add("Socket", cpuSocket(t));
    const g = cpuHasGraphics(t);
    add("Gráficos integrados", g === undefined ? undefined : g ? "Sí" : "No");
    const c = cpuIncludesCooler(t);
    add("Cooler en la caja", c === undefined ? undefined : c ? "Sí" : "No");
  }
  if (kind === "ram") {
    add("Tipo", memType(t));
    add("Capacidad", capacityGb(t), " GB");
  }
  if (kind === "ssd") {
    const gb = capacityGb(t);
    add("Capacidad", gb && gb >= 1000 ? `${gb / 1000} TB` : gb ? `${gb} GB` : undefined);
  }
  if (kind === "psu") add("Potencia", psuWatts(t), " W");
  return rows;
}

/** Precio por GB, para comparar discos y memorias de distinta capacidad. */
export function pricePerGb(p: Product): number | undefined {
  const gb = capacityGb(p.title);
  return gb ? p.price / gb : undefined;
}
