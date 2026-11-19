import { compareLabel, CPU_PERF, GPU_PERF, type PerfModel } from "./perf";
import type { Product } from "./types";

/**
 * "Antes de comprar, mirá": para una placa o un procesador, otro modelo que rinde parecido
 * por menos plata, o uno que rinde bastante más por poco más. Precios de hoy; el rendimiento
 * es la escala aproximada de lib/perf.ts.
 */
export interface Alternative {
  kind: "ahorro" | "salto";
  query: string;
  product: Product;
  /** diferencia de precio contra el buscado (negativa = más barato) */
  delta: number;
  /** cómo rinde contra el buscado */
  perf: ReturnType<typeof compareLabel>;
  /** procesador de otra plataforma: hay que cambiar el mother (y quizás la memoria) */
  platform?: string;
}

/** Modelos del mismo tipo que vale la pena mirar: desde un poco menos (la opción económica) hasta bastante más. */
export function candidatesFor(model: PerfModel, max = 6): PerfModel[] {
  const list = model.kind === "gpu" ? GPU_PERF : CPU_PERF;
  return list
    .filter((m) => m.query !== model.query && m.gaming >= model.gaming * 0.85 && m.gaming <= model.gaming * 1.45)
    .sort((a, b) => Math.abs(a.gaming / model.gaming - 1) - Math.abs(b.gaming / model.gaming - 1))
    .slice(0, max);
}

export function pickAlternatives(
  base: { model: PerfModel; price: number },
  options: { model: PerfModel; product?: Product }[],
): Alternative[] {
  const priced = options.filter((o): o is { model: PerfModel; product: Product } => !!o.product);
  const make = (o: (typeof priced)[number], kind: Alternative["kind"]): Alternative => ({
    kind,
    query: o.model.query,
    product: o.product,
    delta: o.product.price - base.price,
    perf: compareLabel(o.model.gaming, base.model.gaming),
    platform: o.model.socket && base.model.socket && o.model.socket !== base.model.socket ? o.model.socket : undefined,
  });

  // rinde parecido o más y sale al menos 5 % menos: el que más ahorra
  const parecida = priced
    .filter((o) => o.model.gaming >= base.model.gaming * 0.93 && o.product.price <= base.price * 0.95)
    .sort((a, b) => a.product.price - b.product.price || b.model.gaming - a.model.gaming)[0];
  // si no hay, una que rinde un poco menos (hasta 15 %) pero sale bastante menos (20 % o más)
  const economica = parecida
    ? undefined
    : priced
        .filter((o) => o.model.gaming >= base.model.gaming * 0.85 && o.product.price <= base.price * 0.8)
        .sort((a, b) => b.model.gaming - a.model.gaming || a.product.price - b.product.price)[0];
  const ahorro = parecida ?? economica;

  // rinde al menos 12 % más por hasta 25 % más de plata: el que más rinde por peso extra
  const salto = priced
    .filter(
      (o) =>
        o !== ahorro &&
        o.model.gaming >= base.model.gaming * 1.12 &&
        o.product.price > base.price * 0.95 &&
        o.product.price <= base.price * 1.25,
    )
    .sort(
      (a, b) =>
        (b.model.gaming - base.model.gaming) / Math.max(1, b.product.price - base.price) -
        (a.model.gaming - base.model.gaming) / Math.max(1, a.product.price - base.price),
    )[0];

  return [ahorro && make(ahorro, "ahorro"), salto && make(salto, "salto")].filter((x): x is Alternative => !!x);
}
