import { capacityGb, guessKind } from "./versus";
import { compareLabel, perfOf } from "./perf";
import type { Product } from "./types";

/** Duelos destacados de "Uno contra otro": las dudas más comunes al comprar hardware. */
export interface Duelo {
  tema: string;
  a: string;
  b: string;
}

export const DUELOS: Duelo[] = [
  { tema: "NVIDIA vs AMD", a: "RTX 5060", b: "RX 9060 XT" },
  { tema: "NVIDIA vs AMD", a: "RTX 5070", b: "RX 9070 XT" },
  { tema: "¿Vale el Ti?", a: "RTX 5060", b: "RTX 5060 Ti" },
  { tema: "AMD vs Intel", a: "Ryzen 5 7600", b: "Core i5 14400F" },
  { tema: "Generación nueva o anterior", a: "Ryzen 7 7800X3D", b: "Ryzen 7 9800X3D" },
  { tema: "AM4 o AM5", a: "Ryzen 5 5600", b: "Ryzen 5 7600" },
  { tema: "Para jugar sin placa de video", a: "Ryzen 5 5600G", b: "Ryzen 5 8600G" },
  { tema: "¿La de la generación anterior?", a: "RTX 3060", b: "RTX 5060" },
  { tema: "DDR4 o DDR5", a: "DDR4 16GB", b: "DDR5 16GB" },
  { tema: "¿1 TB o 2 TB?", a: "SSD 1TB NVMe", b: "SSD 2TB NVMe" },
];

export interface DueloResult extends Duelo {
  pa?: Product;
  pb?: Product;
  /** "rinde parecido", "rinde más"… de B contra A (solo placas y procesadores de la tabla) */
  perf?: ReturnType<typeof compareLabel>;
  /** discos y memorias: precio por GB de cada uno */
  perGb?: [number, number];
}

/** Arma el resultado de un duelo con los más baratos de cada lado. */
export function dueloResult(d: Duelo, pa?: Product, pb?: Product): DueloResult {
  const ma = perfOf(d.a);
  const mb = perfOf(d.b);
  // precio por GB solo en discos y memorias (en una placa, "12GB" es la memoria de video)
  const byGb = ["ssd", "ram"].includes(guessKind(d.a));
  const gbA = byGb && pa ? capacityGb(pa.title) : undefined;
  const gbB = byGb && pb ? capacityGb(pb.title) : undefined;
  return {
    ...d,
    pa,
    pb,
    perf: ma && mb ? compareLabel(mb.gaming, ma.gaming) : undefined,
    perGb: pa && pb && gbA && gbB && gbA !== gbB ? [Math.round(pa.price / gbA), Math.round(pb.price / gbB)] : undefined,
  };
}
