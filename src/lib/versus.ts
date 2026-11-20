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

export type Kind = "gpu" | "cpu" | "ssd" | "ram" | "psu" | "notebook" | "otro";

/** "notebook rtx 4060" es una notebook; "memoria notebook" o "mochila notebook", no. */
const NB_QUERY = /NOTEBOOK|LAPTOP|ULTRABOOK|MACBOOK|CHROMEBOOK/;
const NB_ACCESSORY = /MEMORIA|SODIMM|\bRAM\b|MOCHILA|FUNDA|MALET[IÍ]N|BOLSO|CARGADOR|FUENTE|COOLER|BASE|SOPORTE|BATER[IÍ]A|TECLADO|PANTALLA|DISPLAY|BISAGRA|DISCO|SSD/;
/** en un título, la notebook se anuncia al principio ("Notebook Gamer…", "Apple MacBook…") */
const NB_TITLE = /^\W*(OUTLET\W+)?(NOTEBOOK|LAPTOP|ULTRABOOK|CHROMEBOOK|(APPLE\s+)?MACBOOK)\b/;

function kindOf(text: string, isTitle: boolean): Kind {
  const s = text.toUpperCase();
  if (isTitle ? NB_TITLE.test(s) : NB_QUERY.test(s) && !NB_ACCESSORY.test(s)) return "notebook";
  if (/\bRTX\b|\bGTX\b|\bRX ?\d|PLACA DE VIDEO|RADEON|GEFORCE|ARC B\d/.test(s)) return "gpu";
  if (/RYZEN|CORE ?I\d|CORE ULTRA|PROCESADOR|\bI[3579][ -]?\d{4,5}/.test(s)) return "cpu";
  if (/SSD|NVME|M\.2/.test(s)) return "ssd";
  if (/DDR[45]|MEMORIA/.test(s)) return "ram";
  if (/FUENTE|\d{3,4} ?W\b/.test(s)) return "psu";
  return "otro";
}

/**
 * Qué tipo de producto es, para elegir qué datos comparar. Manda lo que se buscó; si no
 * alcanza ("lenovo loq"), un título de ejemplo de los resultados.
 */
export function guessKind(query: string, sample?: string): Kind {
  const k = kindOf(query, false);
  return k !== "otro" || !sample ? k : kindOf(sample, true);
}

/** Si un título es de una notebook (y no de un accesorio para notebook). */
export const isNotebookTitle = (title: string) => NB_TITLE.test(title.toUpperCase());

/** Accesorios que nombran a la notebook ("Mochila HP Victus", "Cargador Lenovo LOQ"). */
const ACCESSORY_TITLE =
  /^\W*(MOCHILA|FUNDA|MALET[IÍ]N|BOLSO|CARGADOR|FUENTE|COOLER|BASE|SOPORTE|BATER[IÍ]A|TECLADO|MOUSE|AURICULAR|PANTALLA|DISPLAY|BISAGRA|MEMORIA|DISCO|SSD|MONITOR|PARLANTE|PROTECTOR|SKIN|STICKER|CABLE|ADAPTADOR)/;
export const isAccessoryTitle = (title: string) => ACCESSORY_TITLE.test(title.toUpperCase());

const RAM_SIZES = new Set([4, 8, 12, 16, 18, 24, 32, 36, 48, 64]);

/**
 * Specs de una notebook leídas del título. Los títulos son desprolijos ("R5-7235HS", "8G 512G",
 * "15,6", "FDOS"): lo que no se puede leer con seguridad queda afuera, nunca se adivina.
 */
export function notebookSpecs(title: string): SpecRow[] {
  const t = title.toUpperCase().replace(/[″”“]|''/g, '"');
  const rows: SpecRow[] = [];
  const add = (label: string, value?: string) => value && rows.push({ label, value });
  const apple = /MACBOOK|APPLE/.test(t);

  // procesador
  let cpu: string | undefined;
  let m: RegExpExecArray | null;
  if (apple && (m = /\bM([1-5])(\s+(PRO|MAX))?\b/.exec(t))) cpu = `Apple M${m[1]}${m[3] ? ` ${m[3] === "PRO" ? "Pro" : "Max"}` : ""}`;
  else if ((m = /CORE\s+ULTRA\s+([3579])\s+(\d{3}[A-Z]{0,2})\b/.exec(t))) cpu = `Core Ultra ${m[1]} ${m[2]}`;
  else if ((m = /RYZEN\s?([3579])\s+(?:PRO\s+)?(\d{3,4}[A-Z]{0,3})\b(?!\s?GB?\b)/.exec(t))) cpu = `Ryzen ${m[1]} ${m[2]}`;
  else if ((m = /\bR([3579])[- ](\d{4}[A-Z]{1,3})\b/.exec(t))) cpu = `Ryzen ${m[1]} ${m[2]}`;
  else if ((m = /RYZEN\s?([3579])\b/.exec(t))) cpu = `Ryzen ${m[1]}`;
  else if ((m = /\bI([3579])[- ]?(N?\d{3,5}[A-Z]{0,2}\d?)\b/.exec(t)) && !/^\d{1,3}$/.test(m[2])) cpu = `Core i${m[1]} ${m[2]}`;
  else if ((m = /CORE\s+([3579])\s+(\d{3}[A-Z]?)\b/.exec(t))) cpu = `Core ${m[1]} ${m[2]}`;
  else if ((m = /\b(CELERON|PENTIUM)\s+(N?\d{3,4})\b/.exec(t))) cpu = `${m[1][0]}${m[1].slice(1).toLowerCase()} ${m[2]}`;
  else if ((m = /\bINTEL\s+(N\d{3})\b/.exec(t))) cpu = `Intel ${m[1]}`;
  else if ((m = /\b(?:CORE\s+)?I([3579])\b/.exec(t))) cpu = `Core i${m[1]}`;
  add("Procesador", cpu);

  // placa de video (solo si el título la nombra: las dedicadas siempre se anuncian)
  const gpu = /\b(RTX|GTX)\s?(\d{4})(\s?TI\b)?/.exec(t) ?? /\bRX\s?(\d{4}[SM]?)\b/.exec(t);
  const gpuName = gpu ? (gpu[0].startsWith("RX") ? `RX ${gpu[1]}` : `${gpu[1]} ${gpu[2]}${gpu[3] ? " Ti" : ""}`) : undefined;
  add("Placa de video", gpuName ?? (apple ? "Integrada (Apple)" : undefined));

  // memoria y disco. Cada tamaño se ata a lo que tiene al lado: "16GB RAM", "SSD 512GB" / "512GB SSD";
  // el que va pegado a la placa ("RTX 5050 8GB") es su memoria de video, salvo que diga DDR ("RTX 4050 16GB DDR5")
  const gpuEnd = gpu ? gpu.index + gpu[0].length : -1;
  const sizes = [...t.matchAll(/(\d{1,4})\s?(GB|G|TB)\b/g)].map((x) => ({
    gb: x[2] === "TB" ? Number(x[1]) * 1000 : Number(x[1]),
    at: x.index!,
    before: t.slice(0, x.index!),
    after: t.slice(x.index! + x[0].length),
  }));
  const vram = sizes.find(
    (x) => gpu && x.at >= gpuEnd && x.at - gpuEnd <= 2 && (/^\s*GDDR/.test(x.after) || ([4, 6, 8, 12].includes(x.gb) && !/^\s*(LP)?DDR|^\s*(DE\s+)?RAM\b/.test(x.after))),
  );
  const rest = sizes.filter((x) => x !== vram);
  const ramTagged = rest.find((x) => /^\s*(DE\s+)?RAM\b|^\s*(LP)?DDR/.test(x.after));
  const disk =
    rest.find((x) => x !== ramTagged && /(SSD|NVME|EMMC|HDD)\s*$/.test(x.before)) ??
    rest.find((x) => x !== ramTagged && /^\s*(SSD|NVME|EMMC|HDD)/.test(x.after)) ??
    rest.filter((x) => x !== ramTagged && x.gb >= 120).sort((a, b) => b.gb - a.gb)[0];
  const ram = ramTagged ?? rest.find((x) => x !== disk && RAM_SIZES.has(x.gb));
  const ramType = /\b(LPDDR[45]X?|DDR[45])\b/.exec(t)?.[1];
  add("Memoria", ram && `${ram.gb} GB${ramType ? ` ${ramType}` : ""}`);
  add("Disco", disk && (disk.gb >= 1000 ? `${disk.gb / 1000} TB` : `${disk.gb} GB`));

  // pantalla: pulgadas (con comillas o decimal), resolución y frecuencia
  const inch = /\b(1[0-8](?:[.,]\d)?)\s?("|'|PULG)/.exec(t) ?? /\b(1[1-8][.,]\d)\b/.exec(t);
  const res = /\b(FHD\+?|WUXGA|QHD\+?|WQXGA|2\.?5K|3K|4K|UHD|OLED|HD\+?)\b/.exec(t)?.[1];
  const hz = /\b(\d{2,3})\s?HZ\b/.exec(t)?.[1];
  const screen = [inch && `${inch[1].replace(",", ".")}"`, res, hz && `${hz} Hz`].filter(Boolean).join(" ");
  add("Pantalla", screen || undefined);

  // sistema: en Argentina muchas vienen sin Windows y eso cambia la cuenta
  const os = apple
    ? "macOS"
    : /FREE\s?DOS|\bFDOS\b|SIN\s+(SISTEMA|S\.?O\.?)\b|\bLINUX\b/.test(t)
      ? "Sin Windows"
      : /\bW(IN(DOWS)?)?\s?1[01]|\bWIN\b|\bW11H?\b/.test(t)
        ? "Windows"
        : undefined;
  add("Sistema", os);
  return rows;
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
  if (kind === "notebook") rows.push(...notebookSpecs(t));
  return rows;
}

/** Precio por GB, para comparar discos y memorias de distinta capacidad. */
export function pricePerGb(p: Product): number | undefined {
  const gb = capacityGb(p.title);
  return gb ? p.price / gb : undefined;
}
