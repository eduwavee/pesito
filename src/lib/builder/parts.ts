import type { Product } from "../types";

export type PartId = "cpu" | "cooler" | "mother" | "ram" | "gpu" | "ssd" | "psu" | "case";

export interface PartDef {
  id: PartId;
  /** "Procesador" */
  name: string;
  /** "el procesador": para armar frases */
  article: string;
  /** búsquedas de ejemplo para arrancar */
  hints: string[];
  /** el título tiene que parecer de esta categoría (las tiendas devuelven de todo) */
  guard: RegExp;
  /** descarta accesorios y cosas que matchean el texto pero no son la pieza */
  reject?: RegExp;
  /** se puede saltear: placa de video (gráficos integrados) o cooler (el de caja) */
  skip?: { action: string; chosen: string; short: string; summary: string };
  /** se pueden comprar varias unidades (memorias): hasta cuántas */
  multi?: number;
}

export const PARTS: PartDef[] = [
  {
    id: "cpu",
    name: "Procesador",
    article: "el procesador",
    hints: ["Ryzen 5 7600", "Ryzen 7 7800X3D", "Core i5 14400F", "Ryzen 5 5600G"],
    guard: /procesador|micro|cpu|ryzen|core\s*(i\d|ultra)|intel/i,
    reject: /notebook|cooler|disipador|mother|placa madre|combo|kit|pc armada/i,
  },
  {
    id: "cooler",
    name: "Cooler",
    article: "el cooler",
    hints: ["Cooler CPU", "Cooler Master Hyper 212", "Watercooler 240mm", "DeepCool AK400"],
    guard: /cooler|disipador|refrigeraci[oó]n|water ?cool|\baio\b/i,
    reject: /notebook|pasta|t[eé]rmica|ventilador para gabinete|gabinete|placa de video|mother|soporte|base para|\bm\.2\b|ssd/i,
    skip: {
      action: "Uso el que viene",
      chosen: "Con el cooler de caja",
      short: "De caja",
      summary: "El cooler que viene con el procesador",
    },
  },
  {
    id: "mother",
    name: "Motherboard",
    article: "el motherboard",
    hints: ["B650M", "B550M", "B760M", "X870"],
    guard: /mother|placa madre|mainboard|\bmb\b|motherboard/i,
    reject: /combo|kit|procesador|notebook|cooler|disipador|ventilador|soporte|backplate/i,
  },
  {
    id: "ram",
    name: "Memoria RAM",
    article: "la memoria",
    hints: ["DDR5 16GB", "DDR5 32GB", "DDR4 16GB 3200"],
    multi: 4,
    guard: /memoria|ram|ddr[45]/i,
    reject: /sodimm|so-dimm|notebook|laptop|ssd|placa de video|mother|gddr/i,
  },
  {
    id: "gpu",
    name: "Placa de video",
    article: "la placa de video",
    hints: ["RTX 5060", "RX 9060 XT", "RTX 5070", "RTX 3050"],
    guard: /placa de video|tarjeta de video|geforce|radeon|\brtx\b|\bgtx\b|\brx\s?\d|arc\s?[ab]\d/i,
    reject: /notebook|cable|soporte|riser|cooler|bracket|pc armada/i,
    skip: {
      action: "No necesito placa",
      chosen: "Sin placa de video",
      short: "Sin placa",
      summary: "Sin placa de video (gráficos integrados)",
    },
  },
  {
    id: "ssd",
    name: "Almacenamiento",
    article: "el disco",
    hints: ["SSD 1TB NVMe", "SSD 500GB NVMe", "SSD 2TB"],
    guard: /ssd|nvme|m\.2|disco/i,
    reject: /externo|portable|carry|enclosure|adaptador|cofre|usb/i,
  },
  {
    id: "psu",
    name: "Fuente",
    article: "la fuente",
    hints: ["Fuente 650W", "Fuente 750W 80 Plus Gold", "Fuente 550W"],
    guard: /fuente|psu|power supply/i,
    reject: /notebook|cargador|ups|estabilizador|cable/i,
  },
  {
    id: "case",
    name: "Gabinete",
    article: "el gabinete",
    hints: ["Gabinete", "Gabinete vidrio templado", "Gabinete micro ATX"],
    guard: /gabinete|case|chasis/i,
    // "con fuente" se contaría dos veces con la fuente elegida aparte
    reject: /ventilador|cooler|fan(?!\w)|notebook|disco|con fuente|\+ ?fuente/i,
  },
];

export const PART_IDS = PARTS.map((p) => p.id);

export const partDef = (id: PartId) => PARTS.find((p) => p.id === id)!;

/** PCs armadas y combos traen el nombre de las piezas en el título, pero no son una pieza. */
const NOT_A_PART =
  /pc gamer|pc armada|computadora|equipo armado|teclado|\bcombo\b|servicio|service|instalaci[oó]n|armado de pc|notebook|laptop|\b\d{1,2} ?gb ?- ?\d+ ?(tb|gb)\b/i;

/** ¿Este producto es realmente de la categoría? */
export function fitsCategory(part: PartId, p: Product): boolean {
  const def = partDef(part);
  return (
    def.guard.test(p.title) && !(def.reject?.test(p.title) ?? false) && !NOT_A_PART.test(p.title) && p.inStock !== false
  );
}

/** Elección de una pieza: un producto, o `null` si se salteó a propósito (sin placa de video, cooler de caja). */
export type Pick = Product | null;

/** `qty`: unidades de la pieza (solo memorias); sin `qty` es 1. */
export type Build = Partial<Record<PartId, { query: string; pick?: Pick; qty?: number }>>;

/** Unidades de una pieza, siempre entre 1 y el máximo que permite la categoría. */
export function qtyOf(build: Build, id: PartId): number {
  const max = partDef(id).multi ?? 1;
  return Math.min(max, Math.max(1, Math.round(build[id]?.qty ?? 1)));
}

/** Lo que suma la pieza al total (precio × unidades). */
export function slotPrice(build: Build, id: PartId): number {
  const pick = build[id]?.pick;
  return pick ? pick.price * qtyOf(build, id) : 0;
}
