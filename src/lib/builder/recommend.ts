import type { Build, PartId } from "./parts";
import {
  cpuHasGraphics,
  cpuIncludesCooler,
  cpuSocket,
  cpuWatts,
  memType,
  motherForm,
  motherMemType,
  motherSocket,
  recommendedPsu,
  type MemType,
  type Socket,
} from "./specs";

/**
 * Qué conviene buscar en cada paso según lo que ya se eligió: con un Ryzen 5 7600 (AM5)
 * el mother es B650M o A620M, la memoria DDR5, la placa una que no lo desperdicie, etc.
 * Son búsquedas, no productos: el precio y la compatibilidad fina salen de las ofertas reales.
 */
export interface Recommendation {
  query: string;
  /** por qué la sugerimos, en una frase corta */
  reason: string;
}

/** Gama del procesador: 1 = Ryzen 3 / i3 … 4 = Ryzen 9 / i9. Los X3D cuentan como gama alta. */
export function cpuTier(title: string): 1 | 2 | 3 | 4 {
  const s = title.toUpperCase();
  if (/RYZEN 9|\bI9\b|I9[ -]|ULTRA 9/.test(s)) return 4;
  if (/X3D|RYZEN 7|\bI7\b|I7[ -]|ULTRA 7/.test(s)) return 3;
  if (/RYZEN 5|\bI5\b|I5[ -]|ULTRA 5/.test(s)) return 2;
  return 1;
}

/** "Procesador AMD Ryzen 5 7600 5.1GHz AM5" → "Ryzen 5 7600" (para las frases). */
export function shortName(title: string): string {
  const m =
    /ryzen [3579] \d{4,5}[a-z0-9]*|core (?:ultra [3579] \d{3}[a-z]*|i[3579][ -]?\d{4,5}[a-z]*)|(?:rtx|gtx|rx) ?\d{4}(?: ?(?:ti|xt|super))?|\b[abhzx]\d{3}e?m?\b/i.exec(
      title,
    )?.[0];
  return m ?? title.split(" ").slice(0, 4).join(" ");
}

const MOTHERS: Record<Socket, { base: string[]; high: string[] }> = {
  AM5: { base: ["B650M", "A620M"], high: ["B650", "X870"] },
  AM4: { base: ["B550M", "A520M"], high: ["B550", "X570"] },
  LGA1700: { base: ["B760M", "H610M"], high: ["B760", "Z790"] },
  LGA1851: { base: ["B860M", "H810M"], high: ["B860", "Z890"] },
  LGA1200: { base: ["B560M", "H510M"], high: ["B560", "Z590"] },
};

const CPUS: Record<Socket, string[]> = {
  AM5: ["Ryzen 5 7600", "Ryzen 7 7800X3D", "Ryzen 5 9600X"],
  AM4: ["Ryzen 5 5600", "Ryzen 7 5700X3D", "Ryzen 5 5600G"],
  LGA1700: ["Core i5 14400F", "Core i5 12400F", "Core i7 14700K"],
  LGA1851: ["Core Ultra 5 225", "Core Ultra 7 265K"],
  LGA1200: ["Core i5 11400F", "Core i5 10400F"],
};

/** Placas que no le hacen cuello de botella al procesador (ni al revés), por gama. */
const GPUS: Record<1 | 2 | 3 | 4, string[]> = {
  1: ["RTX 3050", "RX 6600"],
  2: ["RTX 5060", "RX 9060 XT"],
  3: ["RTX 5070", "RX 9070 XT"],
  4: ["RTX 5070 Ti", "RTX 5080"],
};

const PSU_STEPS = [550, 650, 750, 850, 1000, 1200];

/** DDR que usa el armado: la del mother, o la única posible según el socket del procesador. */
function memFor(build: Build): { type: MemType; why: string } | undefined {
  const mother = build.mother?.pick;
  const cpu = build.cpu?.pick;
  const fromMother = mother ? motherMemType(mother.title) : undefined;
  if (fromMother) return { type: fromMother, why: `la que usa tu mother ${shortName(mother!.title)}` };
  const socket = cpu ? cpuSocket(cpu.title) : undefined;
  if (socket === "AM5" || socket === "LGA1851") return { type: "DDR5", why: `la única que acepta ${socket}` };
  if (socket === "AM4" || socket === "LGA1200") return { type: "DDR4", why: `la única que acepta ${socket}` };
  return undefined;
}

export function recommendFor(part: PartId, build: Build): Recommendation[] {
  const cpu = build.cpu?.pick ?? undefined;
  const mother = build.mother?.pick ?? undefined;
  const gpu = build.gpu?.pick ?? undefined;
  const tier = cpu ? cpuTier(cpu.title) : undefined;
  const cpuName = cpu ? shortName(cpu.title) : "";

  switch (part) {
    case "cpu": {
      const socket = mother ? motherSocket(mother.title) : undefined;
      if (!socket) return [];
      return CPUS[socket].map((query) => ({ query, reason: `Socket ${socket}, entra en tu ${shortName(mother!.title)}` }));
    }

    case "mother": {
      const socket = cpu ? cpuSocket(cpu.title) : undefined;
      if (!socket) return [];
      const ram = build.ram?.pick ? memType(build.ram.pick.title) : undefined;
      const k = /\d{4,5}K/i.test(cpu!.title); // Intel K: para overclock hace falta Z
      const list = tier! >= 3 || k ? [...MOTHERS[socket].high, ...MOTHERS[socket].base] : MOTHERS[socket].base;
      // en LGA1700 hay mothers DDR4 y DDR5: si ya hay memoria, que coincida
      const suffix = socket === "LGA1700" && ram ? ` ${ram}` : "";
      return list.map((m) => ({ query: `${m}${suffix}`, reason: `Socket ${socket}, para tu ${cpuName}` }));
    }

    case "ram": {
      const mem = memFor(build);
      if (!mem) return [];
      const big = (tier ?? 2) >= 3 || (gpu && /50[78]0|40[789]0|9070|7900/.test(gpu.title));
      const sizes = big ? ["32GB", "16GB"] : ["16GB", "32GB"];
      const speed = mem.type === "DDR4" ? " 3200" : "";
      return sizes.map((gb) => ({ query: `${mem.type} ${gb}${speed}`, reason: `${mem.type}, ${mem.why}` }));
    }

    case "gpu": {
      if (!cpu) return [];
      const list = GPUS[tier!];
      const igpu = cpuHasGraphics(cpu.title);
      return list.map((query) => ({
        query,
        reason:
          igpu && /\d{4}G\b/i.test(cpu.title)
            ? `Opcional: tu ${cpuName} ya tiene gráficos integrados`
            : `Equilibrada para tu ${cpuName}`,
      }));
    }

    case "cooler": {
      if (!cpu) return [];
      const watts = cpuWatts(cpu.title);
      const boxed = cpuIncludesCooler(cpu.title);
      const why =
        boxed === true ? `Opcional: tu ${cpuName} trae cooler en la caja` : `Tu ${cpuName} disipa ~${watts} W`;
      // las tiendas titulan "Cooler CPU ...": buscar modelos exactos (AK400) suele dar cero
      const list = watts >= 120 ? ["Water cooler 240", "Cooler Deepcool"] : ["Cooler CPU", "Cooler Deepcool"];
      return list.map((query) => ({ query, reason: why }));
    }

    case "ssd": {
      if (!cpu && !mother) return [];
      const list = (tier ?? 2) >= 3 ? ["SSD 2TB NVMe", "SSD 1TB NVMe"] : ["SSD 1TB NVMe", "SSD 500GB NVMe"];
      return list.map((query) => ({ query, reason: "NVMe M.2: el más rápido, entra directo en el mother" }));
    }

    case "psu": {
      if (!cpu && !gpu) return [];
      const need = recommendedPsu(cpu?.title, gpu?.title);
      const w = PSU_STEPS.find((s) => s >= need) ?? PSU_STEPS[PSU_STEPS.length - 1];
      const reason = `Tu equipo pide ~${need} W (con margen)`;
      // certificadas primero: sin 80 Plus lo más barato suele ser una fuente genérica que no conviene
      return (tier ?? 2) >= 3 || need >= 700
        ? [{ query: `Fuente ${w}W 80 Plus Gold`, reason }, { query: `Fuente ${w}W 80 Plus Bronze`, reason }]
        : [{ query: `Fuente ${w}W 80 Plus Bronze`, reason }, { query: `Fuente ${w}W 80 Plus Gold`, reason }];
    }

    case "case": {
      if (!mother) return [];
      const form = motherForm(mother.title);
      if (!form) return [{ query: "Gabinete", reason: `Verificá que entre tu mother ${shortName(mother.title)}` }];
      const reason = `Entra tu mother ${form}`;
      return form === "ITX"
        ? [{ query: "Gabinete ITX", reason }, { query: "Gabinete", reason }]
        : [{ query: "Gabinete", reason }, { query: form === "mATX" ? "Gabinete micro ATX" : "Gabinete ATX", reason }];
    }
  }
}
