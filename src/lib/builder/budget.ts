import type { Product } from "../types";
import { buildTotal, cheapestFit } from "./build";
import { PART_IDS, slotPrice, type Build, type PartId } from "./parts";
import type { Use } from "./presets";
import { recommendFor, shortName } from "./recommend";
import { cpuIncludesCooler } from "./specs";
import { GPU_PERF, perfOf } from "../perf";
import { isExactModel } from "../variants";

/**
 * Armado por presupuesto que usa toda la plata: arranca del armado compatible más barato
 * y, ronda por ronda, sube un escalón la pieza que más rinde por peso para el uso elegido,
 * mientras entre en el presupuesto. Los precios son los de hoy en las tiendas; los puntajes
 * de rendimiento son relativos (solo para comparar escalones entre sí, no se muestran).
 */

export type Brand = "any" | "amd" | "intel";
/** Piezas que ya tenés: no entran en la cuenta. */
export type Owned = Partial<Record<"gpu" | "ssd" | "psu" | "case", boolean>>;
export const OWNABLE = ["gpu", "ssd", "psu", "case"] as const;

type Ladder = "cpu" | "gpu" | "ram" | "ssd";
interface Step {
  query: string;
  /** rendimiento relativo dentro de la escala */
  score: number;
}

interface Platform {
  id: "AM4" | "AM5" | "LGA1700";
  brand: "amd" | "intel";
  mem: "DDR4" | "DDR5";
  /** mother de entrada y uno mejor para procesadores de gama alta */
  mothers: [string, string];
  /** puntaje gaming / edición */
  cpus: { query: string; gaming: number; edicion: number; high?: boolean }[];
  /** con gráficos integrados, para oficina */
  apus: { query: string; score: number }[];
}

/** Procesador de la tabla de rendimiento (lib/perf.ts); `high` = pide un mother mejor. */
function cpu(query: string, high = false): Platform["cpus"][number] {
  const p = perfOf(query)!;
  return { query, gaming: p.gaming, edicion: p.edicion!, high: high || undefined };
}

const PLATFORMS: Platform[] = [
  {
    id: "AM4",
    brand: "amd",
    mem: "DDR4",
    mothers: ["A520M", "B550M"],
    cpus: [
      cpu("Ryzen 5 5500"),
      cpu("Ryzen 5 5600"),
      cpu("Ryzen 7 5700X", true),
      cpu("Ryzen 7 5700X3D", true),
    ],
    apus: [
      { query: "Ryzen 5 5600G", score: 100 },
      { query: "Ryzen 7 5700G", score: 115 },
    ],
  },
  {
    id: "AM5",
    brand: "amd",
    mem: "DDR5",
    mothers: ["A620M", "B650M"],
    cpus: [
      cpu("Ryzen 5 7600"),
      cpu("Ryzen 5 9600X"),
      cpu("Ryzen 7 7700", true),
      cpu("Ryzen 7 7800X3D", true),
      cpu("Ryzen 7 9800X3D", true),
      cpu("Ryzen 9 9900X", true),
      cpu("Ryzen 9 9950X", true),
    ],
    apus: [
      { query: "Ryzen 5 8600G", score: 125 },
      { query: "Ryzen 7 8700G", score: 140 },
    ],
  },
  {
    id: "LGA1700",
    brand: "intel",
    mem: "DDR5",
    mothers: ["H610M DDR5", "B760M DDR5"],
    cpus: [
      cpu("Core i3 12100F"),
      cpu("Core i5 12400F"),
      cpu("Core i5 14400F"),
      cpu("Core i5 14600KF", true),
      cpu("Core i7 14700KF", true),
    ],
    apus: [
      { query: "Core i3 12100", score: 90 },
      { query: "Core i5 12400", score: 105 },
      { query: "Core i5 14400", score: 120 },
    ],
  },
];

/** Escala de placas del armador (puntajes en lib/perf.ts). */
const GPUS: Step[] = ["RX 6600", "RTX 5060", "RX 9060 XT", "RTX 5060 Ti", "RTX 5070", "RX 9070 XT", "RTX 5070 Ti", "RTX 5080"].map(
  (query) => ({ query, score: GPU_PERF.find((g) => g.query === query)!.gaming }),
);

const SSDS: Step[] = [
  { query: "SSD 500GB NVMe", score: 100 },
  { query: "SSD 1TB NVMe", score: 112 },
  { query: "SSD 2TB NVMe", score: 120 },
];

/** Cuánto pesa cada pieza en el rendimiento que importa para cada uso. */
const WEIGHTS: Record<Use, Record<Ladder, number>> = {
  gaming: { gpu: 1, cpu: 0.55, ram: 0.35, ssd: 0.25 },
  edicion: { cpu: 1, ram: 0.6, gpu: 0.5, ssd: 0.4 },
  oficina: { cpu: 1, ram: 0.6, ssd: 0.5, gpu: 0 },
};

function ladders(p: Platform, use: Use, owned: Owned): Partial<Record<Ladder, Step[]>> {
  const cpu =
    use === "oficina"
      ? p.apus
      : [...p.cpus].map((c) => ({ query: c.query, score: c[use] })).sort((a, b) => a.score - b.score);
  const ramSizes = use === "edicion" ? ["32GB", "64GB"] : use === "oficina" ? ["8GB", "16GB", "32GB"] : ["16GB", "32GB"];
  const ram = ramSizes.map((gb, i) => ({
    query: `${p.mem} ${gb}${p.mem === "DDR4" ? " 3200" : ""}`,
    score: 100 + i * 15,
  }));
  const out: Partial<Record<Ladder, Step[]>> = { cpu, ram };
  if (use !== "oficina" && !owned.gpu) {
    // para editar video conviene NVIDIA (NVENC) y al menos una 5060
    out.gpu = use === "edicion" ? GPUS.filter((g) => g.query.startsWith("RTX")) : GPUS;
  }
  if (!owned.ssd) out.ssd = SSDS;
  return out;
}

export type Levels = Partial<Record<Ladder, number>>;

/** Busca y devuelve la lista de productos de una búsqueda (con cache). */
export type Fetch = (part: PartId, query: string) => Promise<Product[]>;

export interface Upgrade {
  part: Ladder;
  from: string;
  to: string;
  /** cuánto cuesta (o ahorra) el cambio de escalón */
  delta: number;
}

export interface BudgetResult {
  platform: Platform["id"];
  build: Build;
  total: number;
  /** ¿entra en el presupuesto? */
  fits: boolean;
  /** el escalón siguiente que no entró, y cuánto falta */
  more?: Upgrade & { extra: number };
  /** el último escalón que sí entró (si bajás el presupuesto, lo perdés) */
  less?: Upgrade;
}

interface Evaluated {
  levels: Levels;
  build: Build;
  total: number;
  utility: number;
  /** faltó algún producto (búsqueda sin resultados) */
  broken: boolean;
}

/**
 * Corre el optimizador para un presupuesto. `fetch` trae los productos (en la app,
 * las tiendas en vivo; en los tests, precios fijos). `onProgress` describe lo que está probando.
 */
export async function optimizeBudget(opts: {
  budget: number;
  use: Use;
  brand: Brand;
  owned: Owned;
  fetch: Fetch;
  onProgress?: (text: string) => void;
  maxRounds?: number;
}): Promise<BudgetResult> {
  const { budget, use, brand, owned, fetch, onProgress, maxRounds = 14 } = opts;
  const platforms = PLATFORMS.filter((p) => brand === "any" || p.brand === brand);
  const results: (BudgetResult & { utility: number })[] = [];
  for (const p of platforms) {
    onProgress?.(`Probando plataforma ${p.id}…`);
    const r = await optimizePlatform(p, budget, use, owned, fetch, onProgress, maxRounds);
    if (r) results.push(r);
  }
  if (!results.length) throw new Error("No encontramos piezas para armar la PC. Probá de nuevo en un rato.");
  // la que más rinde entre las que entran; si ninguna entra, la más barata
  const fitting = results.filter((r) => r.fits);
  const [chosen] = fitting.length ? fitting.sort((a, b) => b.utility - a.utility) : results.sort((a, b) => a.total - b.total);
  const { utility: _u, ...result } = chosen;
  void _u;
  return result;
}

async function optimizePlatform(
  p: Platform,
  budget: number,
  use: Use,
  owned: Owned,
  fetch: Fetch,
  onProgress: ((t: string) => void) | undefined,
  maxRounds: number,
): Promise<(BudgetResult & { utility: number }) | undefined> {
  const lad = ladders(p, use, owned);
  const weights = WEIGHTS[use];
  const cache = new Map<string, Promise<Evaluated>>();

  const evaluate = (levels: Levels) => {
    const key = JSON.stringify(levels);
    let hit = cache.get(key);
    if (!hit) cache.set(key, (hit = assemble(p, lad, levels, owned, fetch, weights, use === "gaming")));
    return hit;
  };

  // el más barato: todos en el primer escalón (si alguno no aparece, probamos el siguiente)
  const start: Levels = Object.fromEntries(Object.keys(lad).map((k) => [k, 0]));
  let cur = await evaluate(start);
  for (const k of Object.keys(lad) as Ladder[]) {
    while (cur.broken && (cur.levels[k] ?? 0) < lad[k]!.length - 1) {
      const next = await evaluate({ ...cur.levels, [k]: (cur.levels[k] ?? 0) + 1 });
      if (!next.broken || next.total < cur.total) cur = next;
      else break;
    }
  }
  if (cur.broken) return undefined;

  let less: Upgrade | undefined;
  let more: (Upgrade & { extra: number }) | undefined;
  for (let round = 0; round < maxRounds; round++) {
    const options = (Object.keys(lad) as Ladder[]).flatMap((k) => {
      const i = cur.levels[k] ?? 0;
      // hasta tres escalones arriba: a veces el siguiente rinde poco y el salto grande conviene más
      return [i + 1, i + 2, i + 3].filter((n) => n < lad[k]!.length).map((n) => ({ k, n }));
    });
    if (!options.length) break;
    const names = options.filter((o) => o.n === (cur.levels[o.k] ?? 0) + 1).map((o) => lad[o.k]![o.n].query);
    onProgress?.(`Comparando ${names.slice(0, 3).join(", ")}…`);
    const evaluated = await Promise.all(options.map((o) => evaluate({ ...cur.levels, [o.k]: o.n }).then((e) => ({ ...o, e }))));
    const valid = evaluated.filter((o) => !o.e.broken && o.e.utility > cur.utility);
    const fits = valid.filter((o) => o.e.total <= budget);
    const value = (o: (typeof valid)[number]) => {
      const dt = o.e.total - cur.total;
      return dt <= 0 ? Infinity : (o.e.utility - cur.utility) / dt;
    };
    const step = (o: (typeof valid)[number]): Upgrade => ({
      part: o.k,
      from: label(cur, o.k),
      to: label(o.e, o.k),
      delta: o.e.total - cur.total,
    });
    if (!fits.length) {
      // lo que falta para el próximo escalón que valga la pena
      const next = valid.sort((a, b) => value(b) - value(a))[0];
      if (next) more = { ...step(next), extra: next.e.total - budget };
      break;
    }
    const best = fits.sort((a, b) => value(b) - value(a))[0];
    less = step(best);
    cur = best.e;
  }

  return {
    platform: p.id,
    build: cur.build,
    total: cur.total,
    fits: cur.total <= budget,
    more,
    less,
    utility: cur.utility,
  };
}

const label = (e: Evaluated, k: Ladder) => {
  const pick = e.build[k]?.pick;
  return pick ? (k === "cpu" || k === "gpu" ? shortName(pick.title) : (e.build[k]?.query ?? "")) : "";
};

/** Arma el armado completo para unos escalones: piezas de la escala + las que dependen de ellas. */
async function assemble(
  p: Platform,
  lad: Partial<Record<Ladder, Step[]>>,
  levels: Levels,
  owned: Owned,
  fetch: Fetch,
  weights: Record<Ladder, number>,
  gaming: boolean,
): Promise<Evaluated> {
  const build: Build = {};
  let broken = false;
  let utility = 0;

  const put = async (part: PartId, query: string) => {
    let list = await fetch(part, query);
    // "Ryzen 5 5600" también trae 5600G/5600GE/5600X y "RTX 5060" trae la Ti: el puntaje es de ese modelo exacto
    if (part === "cpu" || part === "gpu") list = list.filter((p) => isExactModel(p.title, query));
    const pick = cheapestFit(part, list, build);
    if (!pick) broken = true;
    build[part] = { query, pick };
  };
  const ladderStep = (k: Ladder) => lad[k]![levels[k] ?? 0];

  // procesador → mother → memoria (en ese orden, para que la compatibilidad se chequee contra lo anterior)
  const cpu = ladderStep("cpu");
  await put("cpu", cpu.query);
  const high = p.cpus.find((c) => c.query === cpu.query)?.high ?? false;
  await put("mother", p.mothers[high ? 1 : 0]);
  const [ramStep, gpuStep, ssdStep] = [lad.ram ? ladderStep("ram") : undefined, lad.gpu ? ladderStep("gpu") : undefined, lad.ssd ? ladderStep("ssd") : undefined];
  // las que no dependen entre sí, en paralelo
  await Promise.all([
    ramStep ? put("ram", ramStep.query) : undefined,
    gpuStep ? put("gpu", gpuStep.query) : undefined,
    ssdStep ? put("ssd", ssdStep.query) : undefined,
  ]);
  if (!gpuStep) build.gpu = owned.gpu ? { query: "", pick: null, have: true } : { query: "", pick: null };
  if (!ssdStep) build.ssd = { query: "", pick: null, have: true };

  // cooler: el de caja si el procesador lo trae
  const cpuPick = build.cpu?.pick;
  if (cpuPick && cpuIncludesCooler(cpuPick.title) === true) build.cooler = { query: "", pick: null };
  else await put("cooler", recommendFor("cooler", build)[0]?.query ?? "Cooler CPU");

  // fuente según el consumo (si ya tenés la placa, la dimensionamos para una media-alta)
  if (owned.psu) build.psu = { query: "", pick: null, have: true };
  else {
    const forPsu: Build = owned.gpu ? { ...build, gpu: { query: "", pick: OWNED_GPU } } : build;
    await put("psu", recommendFor("psu", forPsu)[0]?.query ?? "Fuente 650W 80 Plus Bronze");
  }
  if (owned.case) build.case = { query: "", pick: null, have: true };
  else await put("case", recommendFor("case", build)[0]?.query ?? "Gabinete");

  // las piezas que ya tenés (o la placa en oficina) no están en la escala: no suman ni restan
  for (const k of Object.keys(lad) as Ladder[]) {
    let score = ladderStep(k).score;
    // en juegos un procesador lento frena a la placa: lo que la placa rinde por encima de eso no se aprovecha
    if (gaming && k === "gpu") score = Math.min(score, ladderStep("cpu").score * GPU_PER_CPU);
    utility += weights[k] * Math.log(score);
  }
  return { levels, build, total: buildTotal(build), utility, broken };
}

/**
 * Cuánta placa (en puntaje) aprovecha cada punto de procesador en juegos: con un Ryzen 5 5600
 * hasta una RTX 5070, con un 7600 hasta una 5070 Ti, la 5080 pide un X3D.
 */
const GPU_PER_CPU = 2.6;

/** Placa de referencia para dimensionar la fuente cuando ya tenés placa de video. */
const OWNED_GPU: Product = {
  id: "propia",
  store: "compragamer",
  title: "Placa de video RTX 5070 (la que ya tenés)",
  price: 0,
  url: "",
};

/** Lo que va a cada pieza, de mayor a menor (para el gráfico del reparto). */
export function spendByPart(build: Build): { part: PartId; amount: number; share: number }[] {
  const total = buildTotal(build);
  if (!total) return [];
  return PART_IDS.map((part) => {
    const amount = slotPrice(build, part);
    return { part, amount, share: amount / total };
  })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Corre como mucho `n` tareas a la vez (para no pedirle 40 búsquedas juntas a las tiendas). */
export function limiter(n: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            queue.shift()?.();
          });
      };
      if (active < n) run();
      else queue.push(run);
    });
}
