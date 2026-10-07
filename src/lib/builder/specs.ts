/**
 * Las tiendas no publican specs estructuradas: las leemos del título.
 * Todo devuelve `undefined` cuando no se puede saber, y ahí la UI pide verificar.
 */

export type Socket = "AM4" | "AM5" | "LGA1200" | "LGA1700" | "LGA1851";
export type MemType = "DDR4" | "DDR5";

const t = (s: string) => s.toUpperCase().replace(/\s+/g, " ");

export function cpuSocket(title: string): Socket | undefined {
  const s = t(title);
  const explicit = /\b(AM4|AM5|LGA ?1200|LGA ?1700|LGA ?1851)\b/.exec(s)?.[1];
  if (explicit) return explicit.replace(" ", "") as Socket;

  // Ryzen: 1000-5000 (y 5600/5700/5800X3D) son AM4; 7000, 8000 y 9000 son AM5
  const ryzen = /RYZEN (?:[3579] )?(\d{4})/.exec(s)?.[1];
  if (ryzen) return Number(ryzen[0]) <= 5 ? "AM4" : "AM5";

  if (/CORE ULTRA [3579] ?2\d{2}/.test(s)) return "LGA1851";
  // Intel Core i3/i5/i7/i9 1xxxx: 12, 13 y 14 gen son LGA1700; 10 y 11 son LGA1200
  const gen = /\bI[3579][ -]?(1[0-4])\d{3}/.exec(s)?.[1];
  if (gen) return Number(gen) >= 12 ? "LGA1700" : "LGA1200";
  return undefined;
}

const CHIPSETS: [RegExp, Socket][] = [
  [/\b(A320|A520|B350|B450|B550|X370|X470|X570)/, "AM4"],
  [/\b(A620|B650E?|B840|B850|X670E?|X870E?)/, "AM5"],
  [/\b(H410|B460|H470|Z490|H510|B560|H570|Z590)/, "LGA1200"],
  [/\b(H610|B660|H670|Z690|B760|H770|Z790)/, "LGA1700"],
  [/\b(H810|B860|Z890)/, "LGA1851"],
];

export function motherSocket(title: string): Socket | undefined {
  const s = t(title);
  const explicit = /\b(AM4|AM5|LGA ?1200|LGA ?1700|LGA ?1851)\b/.exec(s)?.[1];
  if (explicit) return explicit.replace(" ", "") as Socket;
  return CHIPSETS.find(([re]) => re.test(s))?.[1];
}

export function memType(title: string): MemType | undefined {
  return (/\b(DDR[45])\b/.exec(t(title))?.[1] as MemType) ?? undefined;
}

/** Memoria que acepta un mother: la del título o, si no dice, la única posible para su socket. */
export function motherMemType(title: string): MemType | undefined {
  const explicit = memType(title);
  if (explicit) return explicit;
  const socket = motherSocket(title);
  if (socket === "AM5" || socket === "LGA1851") return "DDR5";
  if (socket === "AM4" || socket === "LGA1200") return "DDR4";
  return undefined; // LGA1700 tiene placas DDR4 y DDR5
}

export function psuWatts(title: string): number | undefined {
  const w = /(\d{3,4}) ?W(?:ATTS)?\b/.exec(t(title))?.[1];
  return w ? Number(w) : undefined;
}

/** Consumo típico de cada GPU (TBP en W); la primera coincidencia gana, así "5060 TI" va antes que "5060". */
const GPU_WATTS: [RegExp, number][] = [
  [/5090/, 575],
  [/5080/, 360],
  [/5070 ?TI/, 300],
  [/5070/, 250],
  [/5060 ?TI/, 180],
  [/5060/, 145],
  [/5050/, 130],
  [/4090/, 450],
  [/4080/, 320],
  [/4070 ?TI/, 285],
  [/4070/, 200],
  [/4060 ?TI/, 165],
  [/4060/, 115],
  [/3090/, 350],
  [/3080/, 320],
  [/3070/, 220],
  [/3060 ?TI/, 200],
  [/3060/, 170],
  [/3050/, 130],
  [/1650/, 75],
  [/1660/, 125],
  [/9070 ?XT/, 304],
  [/9070/, 220],
  [/9060 ?XT/, 160],
  [/9060/, 132],
  [/7900/, 315],
  [/7800 ?XT/, 263],
  [/7700 ?XT/, 245],
  [/7600/, 165],
  [/6750/, 250],
  [/6700/, 220],
  [/6650/, 176],
  [/6600/, 132],
  [/6500/, 107],
  [/ARC ?B580/, 190],
  [/ARC ?B570/, 150],
  [/ARC ?A7\d0/, 225],
];

export function gpuWatts(title: string): number | undefined {
  const s = t(title);
  return GPU_WATTS.find(([re]) => re.test(s))?.[1];
}

export function cpuWatts(title: string): number {
  const s = t(title);
  if (/RYZEN 9|\bI9\b|I9[ -]|ULTRA 9/.test(s)) return 170;
  if (/X3D/.test(s)) return 120;
  if (/RYZEN 7|\bI7\b|I7[ -]|ULTRA 7/.test(s)) return 125;
  if (/RYZEN 5|\bI5\b|I5[ -]|ULTRA 5/.test(s)) return 88;
  return 65;
}

/** ¿El procesador tiene gráficos integrados? (para poder saltear la placa de video) */
export function cpuHasGraphics(title: string): boolean | undefined {
  const s = t(title);
  const ryzen = /RYZEN (?:[3579] )?(\d{4,5})([A-Z0-9]*)/.exec(s);
  if (ryzen) {
    const [, num, suffix] = ryzen;
    if (/G/.test(suffix)) return true; // 5600G, 8600G, 8700G
    if (/F/.test(suffix)) return false; // 7500F, 8400F
    return Number(num[0]) >= 7; // 7000/9000 traen gráficos básicos; 5000 sin G no
  }
  const intel = /\bI[3579][ -]?1\d{4}([A-Z]*)|ULTRA [3579] ?2\d{2}([A-Z]*)/.exec(s);
  if (intel) return !/F/.test(intel[1] ?? intel[2] ?? "");
  return undefined;
}

/** Fuente recomendada: consumo estimado + margen del 40 %, redondeado a 50 W. */
export function recommendedPsu(cpuTitle?: string, gpuTitle?: string): number {
  const draw = (cpuTitle ? cpuWatts(cpuTitle) : 65) + (gpuTitle ? (gpuWatts(gpuTitle) ?? 200) : 0) + 75;
  return Math.max(450, Math.ceil((draw * 1.4) / 50) * 50);
}

/**
 * ¿El procesador trae cooler en la caja? Los Ryzen sin X (y los G) traen Wraith;
 * los X, X3D y la serie 9000 no. En Intel, los K/KF no traen y el resto sí.
 */
export function cpuIncludesCooler(title: string): boolean | undefined {
  const s = t(title);
  if (/SIN COOLER|NO INCLUYE COOLER|TRAY|\bOEM\b/.test(s)) return false;
  if (/C\/ ?COOLER|CON COOLER|INCLUYE COOLER|WRAITH/.test(s)) return true;
  const ryzen = /RYZEN (?:[3579] )?(\d{4,5})([A-Z0-9]*)/.exec(s);
  if (ryzen) {
    const [, num, suffix] = ryzen;
    if (/X3D|X/.test(suffix)) return false;
    if (num.startsWith("9")) return false; // la serie 9000 viene sin cooler
    return true;
  }
  const intel = /\bI[3579][ -]?1\d{4}([A-Z]*)|ULTRA [3579] ?2\d{2}([A-Z]*)/.exec(s);
  if (intel) return !/K/.test(intel[1] ?? intel[2] ?? "");
  return undefined;
}

export type FormFactor = "ITX" | "mATX" | "ATX";
const FORM_RANK: Record<FormFactor, number> = { ITX: 1, mATX: 2, ATX: 3 };

/** Formato del mother: explícito en el título o por el sufijo del chipset (B650M = mATX, B650I = ITX). */
export function motherForm(title: string): FormFactor | undefined {
  const s = t(title);
  if (/MINI[- ]?ITX|\bITX\b|\b[ABHZX]\d{3}E?[- ]?I\b/.test(s)) return "ITX";
  if (/MICRO[- ]?ATX|\bM-?ATX\b|\b[ABHZX]\d{3}E?M\b|\b[ABHZX]\d{3}E?M[- ]/.test(s)) return "mATX";
  if (/\bE?-?ATX\b|\b[ABHZX]\d{3}E?\b/.test(s)) return "ATX";
  return undefined;
}

/** El formato más grande de mother que entra en el gabinete, si el título lo dice. */
export function caseForm(title: string): FormFactor | undefined {
  const s = t(title);
  if (/MINI[- ]?ITX|\bITX\b/.test(s)) return "ITX";
  if (/MICRO[- ]?ATX|\bM-?ATX\b|MINI TOWER/.test(s)) return "mATX";
  if (/\bE?-?ATX\b|MID[- ]?TOWER|FULL[- ]?TOWER/.test(s)) return "ATX";
  return undefined;
}

export const formFits = (mother: FormFactor, box: FormFactor) => FORM_RANK[mother] <= FORM_RANK[box];

/** Largo de la placa de video en mm (cuando el título lo trae). */
export function gpuLength(title: string): number | undefined {
  const mm = /(\d{3}) ?MM/.exec(t(title))?.[1];
  return mm && Number(mm) >= 150 && Number(mm) <= 400 ? Number(mm) : undefined;
}

/** Largo máximo de placa de video que acepta el gabinete, si lo dice ("VGA hasta 350mm"). */
export function caseMaxGpu(title: string): number | undefined {
  const mm = /(?:VGA|GPU|PLACA DE VIDEO)[^0-9]{0,18}(\d{3}) ?MM/.exec(t(title))?.[1];
  return mm ? Number(mm) : undefined;
}
