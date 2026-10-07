import type { Product } from "../types";
import { qtyOf, type Build, type PartId } from "./parts";
import {
  caseForm,
  caseMaxGpu,
  cpuHasGraphics,
  cpuIncludesCooler,
  cpuSocket,
  formFits,
  gpuLength,
  motherForm, memType, motherMemType, motherSocket, psuWatts, recommendedPsu } from "./specs";

export type Fit = { level: "ok" | "bad" | "unknown"; reason?: string };

export interface Warning {
  level: "error" | "warn";
  parts: PartId[];
  message: string;
}

const picked = (b: Build, id: PartId) => b[id]?.pick ?? undefined;

/**
 * ¿Esta oferta encaja con lo que ya está elegido?
 * Se usa para ordenar y marcar las ofertas de cada paso.
 */
export function fitFor(part: PartId, p: Product, build: Build): Fit {
  const cpu = picked(build, "cpu");
  const mother = picked(build, "mother");
  const ram = picked(build, "ram");
  const gpu = picked(build, "gpu");

  if (part === "cpu" && mother) {
    const a = cpuSocket(p.title);
    const b = motherSocket(mother.title);
    if (!a || !b) return { level: "unknown", reason: "Verificá el socket" };
    return a === b ? { level: "ok", reason: `Socket ${a}` } : { level: "bad", reason: `Es ${a}, el mother es ${b}` };
  }

  if (part === "mother") {
    const socket = motherSocket(p.title);
    if (cpu) {
      const want = cpuSocket(cpu.title);
      if (!socket || !want) return { level: "unknown", reason: "Verificá el socket" };
      if (socket !== want) return { level: "bad", reason: `Es ${socket}, el procesador es ${want}` };
    }
    if (ram) {
      const a = motherMemType(p.title);
      const b = memType(ram.title);
      if (a && b && a !== b) return { level: "bad", reason: `Usa ${a}, la memoria es ${b}` };
      const qty = qtyOf(build, "ram");
      if (qty > 2 && motherForm(p.title) === "ITX") return { level: "bad", reason: `Tiene 2 ranuras, elegiste ${qty} memorias` };
    }
    const box = picked(build, "case");
    if (box) {
      const a = motherForm(p.title);
      const b = caseForm(box.title);
      if (a && b && !formFits(a, b)) return { level: "bad", reason: `Es ${a}, el gabinete es ${b}` };
    }
    return socket && cpu ? { level: "ok", reason: `Socket ${socket}` } : { level: "unknown" };
  }

  if (part === "ram" && mother) {
    const a = memType(p.title);
    const b = motherMemType(mother.title);
    if (!a || !b) return { level: "unknown", reason: "Verificá DDR4 / DDR5" };
    return a === b ? { level: "ok", reason: a } : { level: "bad", reason: `Es ${a}, el mother usa ${b}` };
  }

  if (part === "case") {
    const box = caseForm(p.title);
    if (mother) {
      const form = motherForm(mother.title);
      if (form && box && !formFits(form, box)) return { level: "bad", reason: `Es ${box}, el mother es ${form}` };
    }
    const max = caseMaxGpu(p.title);
    const len = gpu ? gpuLength(gpu.title) : undefined;
    if (max && len && len > max) return { level: "bad", reason: `La placa mide ${len} mm, entra hasta ${max} mm` };
    return box ? { level: "ok", reason: `Entra ${box}` } : { level: "unknown" };
  }

  if (part === "psu") {
    const w = psuWatts(p.title);
    const need = recommendedPsu(cpu?.title, gpu?.title);
    if (!w) return { level: "unknown", reason: `Necesitás ~${need} W` };
    return w >= need
      ? { level: "ok", reason: `${w} W, alcanza` }
      : { level: "bad", reason: `${w} W, necesitás ~${need} W` };
  }

  return { level: "unknown" };
}

/** Problemas del armado completo, de lo más grave a lo menos grave. */
export function buildWarnings(build: Build): Warning[] {
  const out: Warning[] = [];
  const cpu = picked(build, "cpu");
  const mother = picked(build, "mother");
  const ram = picked(build, "ram");
  const gpu = picked(build, "gpu");
  const psu = picked(build, "psu");

  if (cpu && mother) {
    const a = cpuSocket(cpu.title);
    const b = motherSocket(mother.title);
    if (a && b && a !== b)
      out.push({
        level: "error",
        parts: ["cpu", "mother"],
        message: `El procesador es ${a} y el mother es ${b}: no entra.`,
      });
    else if (!a || !b)
      out.push({
        level: "warn",
        parts: ["cpu", "mother"],
        message: "No pudimos leer el socket del procesador o del mother. Verificalo en la tienda.",
      });
  }

  if (ram && mother) {
    const a = memType(ram.title);
    const b = motherMemType(mother.title);
    if (a && b && a !== b)
      out.push({ level: "error", parts: ["ram", "mother"], message: `La memoria es ${a} y el mother usa ${b}.` });
    else if (!a || !b)
      out.push({
        level: "warn",
        parts: ["ram", "mother"],
        message: "Verificá que la memoria sea DDR4 o DDR5 según el mother.",
      });
  }

  const sticks = qtyOf(build, "ram");
  if (ram && sticks > 1) {
    const form = mother ? motherForm(mother.title) : undefined;
    if (form === "ITX" && sticks > 2)
      out.push({
        level: "error",
        parts: ["ram", "mother"],
        message: `Los mother ITX tienen 2 ranuras de memoria y elegiste ${sticks} módulos.`,
      });
    else if (sticks === 3)
      out.push({
        level: "warn",
        parts: ["ram"],
        message: "Con 3 módulos la memoria deja de andar en dual channel: rinde mejor con 2 o 4.",
      });
    else if (sticks === 4 && form === "mATX")
      out.push({
        level: "warn",
        parts: ["ram", "mother"],
        message: "Verificá que el mother tenga 4 ranuras de memoria: muchos micro ATX traen solo 2.",
      });
  }

  if (build.gpu?.pick === null && cpu && cpuHasGraphics(cpu.title) === false) {
    out.push({
      level: "error",
      parts: ["gpu", "cpu"],
      message: "Este procesador no tiene gráficos integrados: necesitás placa de video.",
    });
  }

  const box = picked(build, "case");
  if (mother && box) {
    const a = motherForm(mother.title);
    const b = caseForm(box.title);
    if (a && b && !formFits(a, b))
      out.push({ level: "error", parts: ["case", "mother"], message: `El mother es ${a} y el gabinete es para ${b}: no entra.` });
  }
  if (gpu && box) {
    const len = gpuLength(gpu.title);
    const max = caseMaxGpu(box.title);
    if (len && max && len > max)
      out.push({ level: "error", parts: ["gpu", "case"], message: `La placa de video mide ${len} mm y el gabinete acepta hasta ${max} mm.` });
  }

  if (build.cooler?.pick === null && cpu && cpuIncludesCooler(cpu.title) === false) {
    out.push({ level: "error", parts: ["cooler", "cpu"], message: "Este procesador no trae cooler en la caja: elegí uno." });
  }

  if (psu) {
    const w = psuWatts(psu.title);
    const need = recommendedPsu(cpu?.title, gpu?.title);
    if (w && w < need)
      out.push({ level: "error", parts: ["psu"], message: `La fuente es de ${w} W y el equipo pide ~${need} W.` });
    else if (!w)
      out.push({
        level: "warn",
        parts: ["psu"],
        message: `No sabemos la potencia de la fuente; el equipo pide ~${need} W.`,
      });
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
}
